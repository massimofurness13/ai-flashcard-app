import sharp from "sharp";

export const MAX_GENERATED_IMAGE_BYTES = 20 * 1024 * 1024;
export class InvalidGeneratedImageError extends Error {
  constructor(public readonly reason: string) {
    super(`The image provider returned an unusable image (${reason}). No image was delivered.`);
    this.name = "InvalidGeneratedImageError";
  }
}

/** Decode actual pixels, not just an HTTP status or file extension. No AI calls. */
export async function checkedGeneratedImage(bytes: Buffer): Promise<{bytes: Buffer; ext: "png"}> {
  try {
    if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES) throw new InvalidGeneratedImageError("invalid file size");
    const input = sharp(bytes, { failOn: "warning", limitInputPixels: 16_777_216 });
    const meta = await input.metadata();
    if (!meta.width || !meta.height || meta.width < 128 || meta.height < 128 || (meta.pages ?? 1) !== 1) {
      throw new InvalidGeneratedImageError("invalid image dimensions");
    }
    // Full decode catches truncated files. Normalise the file to the PNG MIME
    // type used by storage, including providers that actually return JPEG.
    const decoded = await input.rotate().png().toBuffer();
    const {data,info} = await sharp(decoded).resize(64,64,{fit:"fill"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const min = [255,255,255], max = [0,0,0];
    let alpha = 0, dark = 0;
    const pixels = info.width * info.height;
    for (let p=0;p<data.length;p+=4) {
      const a=data[p+3]/255; alpha+=a;
      const rgb=[0,1,2].map(c=>Math.round(data[p+c]*a+255*(1-a)));
      for(let c=0;c<3;c++){min[c]=Math.min(min[c],rgb[c]);max[c]=Math.max(max[c],rgb[c]);}
      if(rgb.every(v=>v<=12))dark++;
    }
    if(alpha/pixels<0.01)throw new InvalidGeneratedImageError("transparent output");
    if(dark/pixels>=0.995)throw new InvalidGeneratedImageError("black output");
    if(max.every((v,c)=>v-min[c]<=2))throw new InvalidGeneratedImageError("blank solid-colour output");
    return {bytes:decoded,ext:"png"};
  } catch(error) {
    if(error instanceof InvalidGeneratedImageError)throw error;
    throw new InvalidGeneratedImageError("corrupt or unsupported file");
  }
}
