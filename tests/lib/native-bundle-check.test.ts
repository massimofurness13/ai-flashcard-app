import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
function verify(code:string,hashCode=code){
 const dir=mkdtempSync(join(tmpdir(),'huella-bundle-check-'));
 try{
  mkdirSync(join(dir,'assets'));writeFileSync(join(dir,'assets/index.js'),code);
  writeFileSync(join(dir,'huella-release.json'),JSON.stringify({supabaseUrl:'https://fghxwycixcawwtctknmp.supabase.co',appUrl:'https://flashmind-35q4.onrender.com',assets:[{file:'assets/index.js',sha256:createHash('sha256').update(hashCode).digest('hex')}]}));
  return spawnSync('python3',['scripts/verify-native-bundle.py',dir],{encoding:'utf8'});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
it('verifies the actual copied production assets',()=>expect(verify('const url="https://fghxwycixcawwtctknmp.supabase.co";').status).toBe(0));
it('rejects placeholders even if the manifest claims production',()=>expect(verify('const url="https://placeholder.supabase.co";').status).toBe(1));
it('rejects assets changed after the build',()=>expect(verify('changed','original').status).toBe(1));
