// Published downloads have their own identity; a candidate version is not a release.
const fs=require('node:fs'),path=require('node:path');
function readDistribution(root,candidateVersion){
 const file=path.join(root,'docs/distribution.json');
 if(!fs.existsSync(file))return {publishedVersion:candidateVersion};
 const value=JSON.parse(fs.readFileSync(file,'utf8'));
 if(value.schemaVersion!==1||Object.keys(value).sort().join(',')!=='publishedVersion,schemaVersion,xpiSha256'||!/^\d+\.\d+\.\d+$/.test(value.publishedVersion)||!/^[a-f0-9]{64}$/.test(value.xpiSha256))throw Error('Invalid published distribution identity');
 const published=value.publishedVersion.split('.').map(Number),candidate=candidateVersion.split('.').map(Number);
 for(let i=0;i<3;i++){if(published[i]<(candidate[i]||0))break;if(published[i]>(candidate[i]||0))throw Error('Published version exceeds candidate version');}
 return value;
}
module.exports={readDistribution};
