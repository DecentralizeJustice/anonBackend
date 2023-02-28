// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2
// /.netlify/functions/test
const handler = async (event) => {
  try {
    console.log(event.body)
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Hello friend` })
    }
  } catch (error) {
    console.log(error)
    return { statusCode: 500, body: error.toString() }
  }
}

module.exports = { handler }
