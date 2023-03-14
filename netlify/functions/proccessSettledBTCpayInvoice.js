const BTCpayKey = process.env.BTCpayKey
const BTCpayStore = process.env.BTCpayStore 
const axios = require("axios")
const mongoDBPassword = process.env.mongoDBPassword
const mongoServerLocation = process.env.mongoServerLocation
const { MongoClient, ServerApiVersion } = require('mongodb')
const Joi = require("joi")
const crypto = require('crypto');
const hri = require('human-readable-ids').hri
const uri = "mongodb+srv://main:" + mongoDBPassword + "@"+ mongoServerLocation + "/?retryWrites=true&w=majority"
const storeAddress = 'https://btcpay.anonshop.app/api/v1/stores/' + BTCpayStore + '/invoices/'
exports.handler = async (event) => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 })
    try {
      const params = JSON.parse(event.body)
      const invoiceId = params.invoiceId
      const invoiceIdschema = Joi.string().required().alphanum().min(22).max(22)
      await invoiceIdschema.validateAsync(invoiceId)
      if(params.type !== 'InvoiceSettled'){
        await client.close() 
        return {statusCode: 200, body: '' }
      }
      const response = await axios.get(
        storeAddress + invoiceId + `/payment-methods`,
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': BTCpayKey
            }
        }
      ) 
    const paymentInfo = response.data
    switch (params.metadata.type) {
      case 'firstLockerOrder':
        await processFirstLockerOrder(paymentInfo, invoiceId, params, client)
        break;
      case 'firstAddressOrder':
        await processFirstAddressOrder(paymentInfo, invoiceId, params, client)
        break;
      default:
        console.log(`No order type matched.`);
    }

    await client.close()
    return {
      statusCode: 200,
      body: ''
    }
    } catch (error) {
      console.log(error)
      await client.close()
      return {
        statusCode: 500,
        body: ''
      }
    }

}
async function processFirstAddressOrder(paymentInfo, invoiceId, params, client){
  const collection = client.db("accounts").collection("accountInfo")
  const numberArraySchema = Joi.array().length(8).items(Joi.number().max(2050).min(0))
  await numberArraySchema.validateAsync(params.metadata.numberArray)
  const numberArray = params.metadata.numberArray.toString()
  const query = { passphrase: numberArray }
  const exist = await collection.findOne(query)
  if(exist !== null){
    await client.close()
    console.log('error: "account already exist"')
    return {statusCode: 200, body: '' }
  }
  const randomString = crypto.randomBytes(16).toString('hex')
  const orderInfo = {
    chatID: crypto.createHash('sha256').update(randomString).digest('hex'),
    statusHistory: [  { status :"Pending Approval" , timeStamp: Date.now() } ],
    paymentInfo: paymentInfo,
    btcPayInvoice: invoiceId,
    addressInfo: {
      country: params.metadata.addressInfo.country,
      zipcode: params.metadata.addressInfo.zipcode,
      city: params.metadata.addressInfo.zipcode,
      streetAddress: params.metadata.addressInfo.streetAddress,
      fullname: params.metadata.addressInfo.fullname,
    },
    itemList: params.metadata.itemList,
    extraNotes: params.metadata.extraNotes,
    type: params.metadata.type,
    totalUSD: params.metadata.amount,
    taxAmountUSD: params.metadata.taxAmount,
    itemsSubtotal: params.metadata.orderSubtotal,
    bondUSD: params.metadata.bondUSD,
    orderFeeUSD: params.metadata.serviceFeeUSD,
    extraAmountUSD: params.metadata.extraAmountUSD,
    refundAddress: params.metadata.refundAddress,
    discountPercent: params.metadata.discountPercent,
    discountPossible: params.metadata.discountPossible,
    nickName: hri.random()
  }
  await sanatizeFirstAddressOrderInfo(orderInfo)
  const docInfo = { 
    passphrase: numberArray, 
    metaData: { 
      email: null,
      bondAmount: (Number(params.metadata.bondUSD)/Number(paymentInfo[0].rate)).toFixed(13),
      refundAddress: params.metadata.refundAddress,
      addressShoppingOrdersCompleted: 0
    },
    orders: [
      orderInfo
    ],
  }
  const doc = docInfo
  await collection.insertOne(doc)
}
async function sanatizeFirstAddressOrderInfo(orderInfo){
  const addressInfoSchema = Joi.object({
    country: Joi.string().required().alphanum().min(0).max(99),
    zipcode: Joi.number().required().min(0).max(999999),
    city: Joi.string().required().min(0).max(99),
    streetAddress: Joi.string().required().min(0).max(999),
    fullname: Joi.string().required().min(0).max(99),
  })
  const itemSchema = Joi.object().length(4).keys({
    link: Joi.string().required().min(1).max(99999),
    description: Joi.string().required().min(0).max(99999),
    cost:Joi.number().required().min(0).max(99999),
    quantity:Joi.number().required().min(0).max(99999),
  })
  const itemListSchema = Joi.array().required().min(1).max(20).items(itemSchema)
  const objectSchema = Joi.object({
    chatID: Joi.string().required().hex().max(99999),
    statusHistory: Joi.array().required().length(1),
    paymentInfo: Joi.array().required(),
    btcPayInvoice: Joi.string().required().alphanum().length(22),
    addressInfo: addressInfoSchema,
    itemList: itemListSchema,
    extraNotes: Joi.string().required().min(0).max(99999),
    type: Joi.string().required().min(0).max(50),
    totalUSD: Joi.number().required().min(0).max(99999),
    taxAmountUSD: Joi.number().required().min(0).max(99999),
    itemsSubtotal: Joi.number().required().min(0).max(99999),
    bondUSD: Joi.number().required().min(0).max(99999),
    orderFeeUSD: Joi.number().required().min(0).max(99999),
    extraAmountUSD: Joi.number().required().min(0).max(99999),
    refundAddress: Joi.string().required().alphanum().min(1).max(110),
    discountPercent: Joi.number().required().min(0).max(100),
    discountPossible: Joi.boolean().required(),
    nickName: Joi.string().required()
  })
  await objectSchema.validateAsync(orderInfo)
  return true
}
async function processFirstLockerOrder(paymentInfo, invoiceId, params, client){
  const collection = client.db("accounts").collection("accountInfo")
  const numberArraySchema = Joi.array().length(8).items(Joi.number().max(2050).min(0))
  await numberArraySchema.validateAsync(params.metadata.numberArray)
  const numberArray = params.metadata.numberArray.toString()
  const query = { passphrase: numberArray }
  const exist = await collection.findOne(query)
  if(exist !== null){
    await client.close()
    console.log('error: "account already exist"')
    return {statusCode: 200, body: '' }
  }
  const randomString = crypto.randomBytes(16).toString('hex')
  const orderInfo = {
    chatID: crypto.createHash('sha256').update(randomString).digest('hex'),
    statusHistory: [  { status :"Pending Approval" , timeStamp: Date.now() } ],
    paymentInfo: paymentInfo,
    btcPayInvoice: invoiceId,
    itemList: params.metadata.itemList,
    country: params.metadata.country,
    lockerZipcode: params.metadata.lockerZipcode,
    lockerName: params.metadata.lockerName,
    extraNotes: params.metadata.extraNotes,
    type: params.metadata.type,
    totalUSD: params.metadata.amount,
    taxAmountUSD: params.metadata.taxAmount,
    itemsSubtotal: params.metadata.orderSubtotal,
    bondUSD: params.metadata.bondUSD,
    orderFeeUSD: params.metadata.serviceFeeUSD,
    extraAmountUSD: params.metadata.extraAmountUSD,
    refundAddress: params.metadata.refundAddress,
    discountPercent: params.metadata.discountPercent,
    discountPossible: params.metadata.discountPossible,
    nickName: hri.random()
  }
  await sanatizeFirstLockerOrderInfo(orderInfo)
  const docInfo = { 
    passphrase: numberArray, 
    metaData: { 
      email: null,
      bondAmount: (Number(params.metadata.bondUSD)/Number(paymentInfo[0].rate)).toFixed(13),
      refundAddress: params.metadata.refundAddress,
      lockerShoppingOrdersCompleted: 0
    },
    orders: [
      orderInfo
    ],
  }
  const doc = docInfo
  await collection.insertOne(doc)
}
async function sanatizeFirstLockerOrderInfo(orderInfo){
  const itemSchema = Joi.object().length(4).keys({
    link: Joi.string().required().min(1).max(99999),
    description: Joi.string().required().min(0).max(99999),
    cost:Joi.number().required().min(0).max(99999),
    quantity:Joi.number().required().min(0).max(99999),
  })
  const itemListSchema = Joi.array().required().min(1).max(20).items(itemSchema)
  const objectSchema = Joi.object({
    chatID: Joi.string().required().hex().max(99999),
    statusHistory: Joi.array().required().length(1),
    paymentInfo: Joi.array().required(),
    btcPayInvoice: Joi.string().required().alphanum().length(22),
    itemList: itemListSchema,
    country: Joi.string().required().alphanum().min(0).max(99),
    lockerZipcode: Joi.number().required().min(0).max(999999),
    lockerName: Joi.string().required().alphanum().min(0).max(99),
    extraNotes: Joi.string().required().min(0).max(99999),
    type: Joi.string().required().min(0).max(50),
    totalUSD: Joi.number().required().min(0).max(99999),
    taxAmountUSD: Joi.number().required().min(0).max(99999),
    itemsSubtotal: Joi.number().required().min(0).max(99999),
    bondUSD: Joi.number().required().min(0).max(99999),
    orderFeeUSD: Joi.number().required().min(0).max(99999),
    extraAmountUSD: Joi.number().required().min(0).max(99999),
    refundAddress: Joi.string().required().alphanum().min(1).max(110),
    discountPercent: Joi.number().required().min(0).max(100),
    discountPossible: Joi.boolean().required(),
    nickName: Joi.string().required()
  })
  await objectSchema.validateAsync(orderInfo)
  return true
}