export async function getIpInfo(userip : string): Promise<any> {
  const res = await fetch(`https://ip.guide/${userip}`);
  if (!res.ok) throw new Error(`ip.guide responded with ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
