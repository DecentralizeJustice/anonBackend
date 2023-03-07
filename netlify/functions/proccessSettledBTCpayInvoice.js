const BTCpayKey = process.env.BTCpayKey
const BTCpayStore = process.env.BTCpayStore 
const axios = require("axios")
const mongoDBPassword = process.env.mongoDBPassword
const mongoServerLocation = process.env.mongoServerLocation
const { MongoClient, ServerApiVersion } = require('mongodb')
const crypto = require('crypto');
const hri = require('human-readable-ids').hri
const uri = "mongodb+srv://main:" + mongoDBPassword + "@"+ mongoServerLocation + "/?retryWrites=true&w=majority"
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 })
const storeAddress = 'https://btcpay.anonshop.app/api/v1/stores/' + BTCpayStore + '/invoices/'
exports.handler = async (event) => {

    try {
      const params = JSON.parse(event.body)
      console.log(params)
      const invoiceId = params.invoiceId
      if(params.type !== 'InvoiceSettled'){ return {statusCode: 200, body: '' }}
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
    const collection = client.db("accounts").collection("accountInfo")
    const parsed = params
    const numberArray = parsed.metadata.numberArray.toString()
    const query = { passphrase: numberArray }
    const exist = await collection.findOne(query)
    if(exist !== null){ 
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'account already exist' })
      }
    }
    const orderInfo = {
      chatID: crypto.createHash('sha256').update(invoiceId).digest('hex'),
      statusHistory: [  { status :"pending approval" , timeStamp: Date.now() } ],
      paymentInfo: paymentInfo,
      btcPayInvoice: invoiceId,
      itemList: parsed.metadata.itemList,
      country: parsed.metadata.country,
      lockerZipcode: parsed.metadata.lockerZipcode,
      lockerName: parsed.metadata.lockerName,
      extraNotes: parsed.metadata.extraNotes,
      type: parsed.metadata.type,
      totalUSD: parsed.metadata.amount,
      taxAmountUSD: parsed.metadata.taxAmount,
      itemsSubtotal: parsed.metadata.orderSubtotal,
      bondUSD: parsed.metadata.bondUSD,
      orderFeeUSD: parsed.metadata.serviceFeeUSD,
      extraAmountUSD: parsed.metadata.extraAmountUSD,
      refundAddress: parsed.metadata.refundAddress,
      discountPercent: parsed.metadata.discountPercent,
      discountPossible: parsed.metadata.discountPossible,
      nickName: hri.random()
    }
    const doc = { 
      passphrase: numberArray, 
      metaData: { 
        email: null,
        bondAmount: parsed.metadata.bondUSD,
        refundAddress: parsed.metadata.refundAddress,
        shoppingOrdersCompleted: 0,
        earningOrdersCompleted: 0
      },
      orders: [
        orderInfo
      ],
    }
    await collection.insertOne(doc)
    client.close()
    return {
      statusCode: 200,
      body: ''
    }
    } catch (error) {
      console.log(error)
      return {
        statusCode: 500,
        body: ''
      }
    }

}
