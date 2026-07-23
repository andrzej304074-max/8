import { del, put } from "@vercel/blob";
import type { StorageProvider } from "./index";

export class VercelBlobProvider implements StorageProvider {
  constructor(private readonly token: string) {}

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const result = await put(key, data, {
      access: "public",
      contentType,
      token: this.token,
      // Losowy sufiks sprawia, że adresów nie da się zgadnąć mimo publicznego dostępu.
      addRandomSuffix: true,
    });
    return result.url;
  }

  async delete(key: string): Promise<void> {
    await del(key, { token: this.token });
  }

  publicUrl(key: string): string {
    return key;
  }
}
