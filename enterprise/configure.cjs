'use strict';
const fs=require('node:fs');
const profiles=require('../enterprise_profiles.js');
try {
    const args=process.argv.slice(2),selection={};let output=null;
    for(let i=0;i<args.length;i+=2) {
        const key=args[i];if(!key?.startsWith('--')||i+1>=args.length)throw new Error('PROFILE_ARGUMENT_INVALID');
        const name=key.slice(2);if(name==='out'){if(output!==null)throw new Error('PROFILE_ARGUMENT_INVALID');output=args[i+1];}
        else {if(!Object.hasOwn(profiles.categories,name)||Object.hasOwn(selection,name))throw new Error('PROFILE_ARGUMENT_INVALID');selection[name]=args[i+1];}
    }
    const content=JSON.stringify(profiles.buildDraft(selection),null,2)+'\n';
    // Never overwrite an existing operator configuration or credential file.
    if(output)fs.writeFileSync(output,content,{encoding:'utf8',flag:'wx',mode:0o600});
    else process.stdout.write(content);
} catch(error){process.stderr.write((['PROFILE_SELECTION_INVALID','PROFILE_ARGUMENT_INVALID'].includes(error.message)?error.message:error.code||'PROFILE_WRITE_FAILED')+'\n');process.exitCode=1;}
