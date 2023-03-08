const BTCpayKey = process.env.BTCpayKey
const BTCpayStore = process.env.BTCpayStore 
const axios = require("axios")
const mongoDBPassword = process.env.mongoDBPassword
const mongoServerLocation = process.env.mongoServerLocation
const { MongoClient, ServerApiVersion } = require('mongodb')
const crypto = require('crypto');
const hri = require('human-readable-ids').hri
const uri = "mongodb+srv://main:" + mongoDBPassword + "@"+ mongoServerLocation + "/?retryWrites=true&w=majority"
const storeAddress = 'https://btcpay.anonshop.app/api/v1/stores/' + BTCpayStore + '/invoices/'
exports.handler = async (event) => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 })
    try {
      const params = JSON.parse(event.body)
      const invoiceId = params.invoiceId
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
      default:
        console.log(`Sorry, we are out of.`);
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


async function processFirstLockerOrder(paymentInfo, invoiceId, params, client){
  const collection = client.db("accounts").collection("accountInfo")
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