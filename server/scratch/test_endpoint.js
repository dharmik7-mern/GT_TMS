import axios from 'axios';

async function testEndpoint() {
  try {
    const url = 'http://localhost:5002/api/v1/users/69dc90651262f9551e6d879f';
    const res = await axios.get(url).catch(e => e.response);
    console.log('Status:', res?.status);
    console.log('Body:', JSON.stringify(res?.data, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testEndpoint();
