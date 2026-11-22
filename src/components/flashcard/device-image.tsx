"use client";
import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { useDeviceAccount } from "@/components/layout/device-provider";
import { downloadMedia, savedMedia, validMediaUrl } from "@/lib/device-media";

export function DeviceImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const { user } = useDeviceAccount();
  const [resolved, setResolved] = useState<{ key: string; url: string }>();
  const key = `${user?.id}:${src}`;
  useEffect(() => {
    if (!user || !validMediaUrl(src)) return;
    let active = true;
    void savedMedia(user.id, src).then(async saved => {
      if (!saved && active) setResolved({ key, url: src });
      const local = saved || await downloadMedia(user.id, src);
      if (active) setResolved({ key, url: local });
    }).catch(() => { if (active) setResolved({ key, url: src }); });
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<{owner:string;url:string}>).detail;
      if (detail?.owner !== user.id || detail.url !== src) return;
      void savedMedia(user.id, src).then(local => { if (active && local) setResolved({key,url:local}); }).catch(() => {});
    };
    window.addEventListener("huella:media-saved", onSaved);
    return () => { active = false; window.removeEventListener("huella:media-saved", onSaved); };
  }, [user, src, key]);
  // A new file remains viewable even if the device has no space to save it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={resolved?.key === key ? resolved.url : !user || !validMediaUrl(src) ? src : undefined} alt={alt ?? ""} />;
}
