import { cookies } from 'next/headers';
const base=process.env.BACKEND_API_URL??'http://127.0.0.1:4000';
export async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const jar=await cookies();const token=jar.get('sentinel_token')?.value;const workspace=jar.get('sentinel_workspace')?.value;
 const headers=new Headers(init?.headers);headers.set('accept','application/json');if(init?.body)headers.set('content-type','application/json');if(token)headers.set('authorization',`Bearer ${token}`);if(workspace)headers.set('x-workspace-id',workspace);
 const r=await fetch(`${base}${path}`,{...init,headers,cache:'no-store'});if(!r.ok){const body=await r.text();throw new Error(`API ${r.status}: ${body}`);}return r.json() as Promise<T>;
}
