// Research contract only. No production store, migration or MIME canonicalization.
const fs=require('node:fs'),crypto=require('node:crypto');
function exactRawProof(bytes){
 if(!Buffer.isBuffer(bytes))throw TypeError('Exact raw bytes are required');
 return {schemaVersion:1,kind:'thundy-content-proof',algorithm:'raw-exact-sha256-v1',scope:'raw-decrypt-false',byteLength:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
if(require.main===module){
 if(process.argv.length!==3)throw Error('Usage: node tools/content-proof.dev.cjs /absolute/path/to/synthetic.eml');
 process.stdout.write(JSON.stringify(exactRawProof(fs.readFileSync(process.argv[2])),null,2)+'\n');
}
module.exports={exactRawProof};
