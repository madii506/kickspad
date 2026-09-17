// Read a Kick channel server-side. Honest failure: if Kick/Cloudflare refuses,
// say so — never a zero.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const slugOf = (c='') => String(c).trim().toLowerCase().replace(/^https?:\/\/(www\.)?kick\.com\//,'').replace(/[?#].*$/,'').replace(/\/.*$/,'').replace(/^@/,'').replace(/[^a-z0-9_\-]/g,'').slice(0,40);
async function grab(url, ms=6000){
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),ms);
  try{
    const r=await fetch(url,{signal:ctl.signal,headers:{'user-agent':UA,accept:'application/json, text/plain, */*','accept-language':'en-US,en;q=0.9'}});
    const ct=r.headers.get('content-type')||'';
    if(!r.ok||!ct.includes('json')) return {err:r.status||0};
    return {j:await r.json()};
  }catch(e){ return {err:0}; } finally{ clearTimeout(t); }
}
export default async function handler(req,res){
  const t0=Date.now(); const slug=slugOf(req.query?.c);
  res.setHeader('cache-control','s-maxage=60, stale-while-revalidate=300');
  if(!slug) return res.status(400).json({ok:false,reason:'no channel'});
  let last=0;
  for(const [src,url] of [['v2',`https://kick.com/api/v2/channels/${slug}`],['v1',`https://kick.com/api/v1/channels/${slug}`]]){
    const r=await grab(url);
    if(r.j){
      const j=r.j; const u=j.user||{}; const ls=j.livestream||null;
      return res.status(200).json({ok:true,slug:j.slug||slug,name:u.username||j.slug||slug,followers:j.followers_count??j.followersCount??null,
        avatar:u.profile_pic||u.profilepic||null,live:!!(ls&&(ls.is_live??true)),title:ls?.session_title||null,src,ms:Date.now()-t0});
    }
    last=r.err;
  }
  return res.status(200).json({ok:false,slug,reason:'kick refused the server read',status:last,ms:Date.now()-t0});
}
