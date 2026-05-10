const crypto = require('crypto');
// just a skeleton for virustotal API
async function checkVT(hash, apikey) {
    if (!apikey) return null;
    const url = `https://www.virustotal.com/api/v3/files/${hash}`;
    const options = {
        method: 'GET',
        headers: {
            'x-apikey': apikey,
            'accept': 'application/json'
        }
    };
    try {
        const response = await fetch(url, options);
        if (response.status === 200) {
            return await response.json();
        }
        return null;
    } catch (e) {
        return null;
    }
}
