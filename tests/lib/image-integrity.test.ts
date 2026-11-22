import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {checkedGeneratedImage} from '@/lib/image-integrity';
const solid=(background: string)=>sharp({create:{width:256,height:256,channels:4,background}}).png().toBuffer();
describe('generated image integrity',()=>{
 it.each(['black','#080808','white','#ff0000','transparent'])('rejects blank %s pixels',async colour=>{
  await expect(checkedGeneratedImage(await solid(colour))).rejects.toThrow('unusable image');
 });
 it('rejects corrupt, empty and tiny placeholder files',async()=>{
  for(const bytes of [Buffer.from('not an image'),Buffer.alloc(0),await sharp({create:{width:1,height:1,channels:3,background:'black'}}).png().toBuffer()])await expect(checkedGeneratedImage(bytes)).rejects.toThrow('unusable image');
 });
 it('accepts dark artwork with visible detail and normalises actual JPEG bytes',async()=>{
  const image=await sharp({create:{width:256,height:256,channels:3,background:'#151520'}}).composite([{input:Buffer.from('<svg width="256" height="256"><circle cx="128" cy="128" r="45" fill="#d4a373"/></svg>')}]).jpeg().toBuffer();
  const result=await checkedGeneratedImage(image);expect(result.ext).toBe('png');expect((await sharp(result.bytes).metadata()).format).toBe('png');
 });
 it('rejects a truncated file even when its header is readable',async()=>{
  const image=await solid('blue');await expect(checkedGeneratedImage(image.subarray(0,Math.floor(image.length/2)))).rejects.toThrow('unusable image');
 });
});
