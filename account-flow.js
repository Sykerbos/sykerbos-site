export function accountError(error){
  const code=error?.code;
  if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit'||error?.status===429)return 'Too many email requests. Please wait before trying again, or try the guest demo now.';
  if(code==='invalid_credentials')return 'Email or password not recognised. Check both and try again.';
  if(code==='email_not_confirmed')return 'Confirm your email first, then return here to sign in.';
  if(code==='weak_password')return 'Choose a stronger password and try again.';
  return error?.message||'Could not connect to sign-in. Please try again, or open the guest demo.';
}
export async function accountRequest({mode,email,password,loadClient}){
  try{
    const client=await loadClient();
    const {data,error}=mode==='signup'?await client.auth.signUp({email:email.trim(),password}):await client.auth.signInWithPassword({email:email.trim(),password});
    if(error)return {message:accountError(error),type:'error'};
    if(data?.session)return {next:'app.html'};
    if(mode==='signup')return {message:'Check your inbox for a confirmation email, then return here to sign in. No email? Please check spam before trying again.',type:'success'};
    return {message:'Sign-in did not complete. Please try again, or open the guest demo.',type:'error'};
  }catch{
    return {message:'Could not connect to sign-in. Please try again, or open the guest demo. No account is needed to explore.',type:'error'};
  }
}
