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
    console.log(paymentInfo)
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
    const docInfo = { 
      passphrase: numberArray, 
      metaData: { 
        email: null,
        bondAmount: (Number(parsed.metadata.bondUSD)/Number(paymentInfo[0].rate)).toFixed(13),
        refundAddress: parsed.metadata.refundAddress,
        lockerOrdersCompleted: 0
      },
      orders: [
        orderInfo
      ],
    }
    const doc = docInfo
    await collection.insertOne(doc)
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
