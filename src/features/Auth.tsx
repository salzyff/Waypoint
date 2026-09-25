import {useMemo, useState} from 'react';
import {Eye, EyeOff, LockKeyhole, Mail, ShieldCheck} from 'lucide-react';
import {Link, Navigate} from 'react-router-dom';
import {Logo} from '../components/Shell';
import {Button} from '../components/ui';
import {demo, supabase} from '../services/backend';
import {useStore} from '../app/store';

const authRedirect=()=>{
 const configured=import.meta.env.VITE_SITE_URL?.trim();
 const base=configured||window.location.origin;
 const absolute=/^https?:\/\//i.test(base)?base:`https://${base}`;
 return new URL('/dashboard',absolute).toString();
};

function PasswordInput({label,value,onChange,visible,onToggle,autoComplete,description}:{label:string;value:string;onChange:(value:string)=>void;visible:boolean;onToggle:()=>void;autoComplete:string;description?:string}){
 return <label className="field password-field">{label}<div className="password-control"><LockKeyhole size={16}/><input type={visible?'text':'password'} required minLength={8} value={value} onChange={e=>onChange(e.target.value)} autoComplete={autoComplete}/><button type="button" className="password-toggle" onClick={onToggle} aria-label={visible?`Hide ${label.toLowerCase()}`:`Show ${label.toLowerCase()}`}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{description&&<small className="field-hint">{description}</small>}</label>;
}

export default function Auth(){
 const{user}=useStore();
 const[email,setEmail]=useState('');
 const[password,setPassword]=useState('');
 const[confirmPassword,setConfirmPassword]=useState('');
 const[message,setMessage]=useState('');
 const[busy,setBusy]=useState(false);
 const[signup,setSignup]=useState(false);
 const[showPassword,setShowPassword]=useState(false);
 const[showConfirm,setShowConfirm]=useState(false);
 const passwordChecks=useMemo(()=>({length:password.length>=8,upper:/[A-Z]/.test(password),number:/\d/.test(password)}),[password]);
 const passwordReady=passwordChecks.length&&passwordChecks.upper&&passwordChecks.number;
 if(user&&!demo)return <Navigate to="/dashboard"/>;
 async function submit(magic=false){
  setMessage('');
  if(!supabase){setMessage('Live authentication is not configured. Add the Supabase environment variables before using accounts.');return}
  if(signup&&!passwordReady){setMessage('Use at least 8 characters, including one capital letter and one number.');return}
  if(signup&&password!==confirmPassword){setMessage('Your passwords do not match.');return}
  setBusy(true);
  const redirectTo=authRedirect();
  const result=magic
   ?await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}})
   :signup
    ?await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}})
    :await supabase.auth.signInWithPassword({email,password});
  setMessage(result.error?.message??(magic||signup?'Check your email to continue.':'Signed in.'));
  setBusy(false);
 }
 return <div className="auth-page"><Logo/><div className="panel auth-card"><div className="eyebrow">COMPILE BEFORE YOU SHIP.</div><h1>{signup?'Create your workspace account.':'Welcome back.'}</h1><p>{signup?'Set up a secure account for your organisation’s preparation workspace.':'Sign in to your organisation’s preparation workspace.'}</p><form onSubmit={e=>{e.preventDefault();void submit()}}><label className="field">Work email<div className="input-with-icon"><Mail size={16}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com"/></div></label><PasswordInput label="Password" value={password} onChange={setPassword} visible={showPassword} onToggle={()=>setShowPassword(v=>!v)} autoComplete={signup?'new-password':'current-password'} description={signup?'At least 8 characters, one capital letter, and one number.':undefined}/>{signup&&<><PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirm} onToggle={()=>setShowConfirm(v=>!v)} autoComplete="new-password"/><div className="password-checks" aria-live="polite"><span className={passwordChecks.length?'valid':''}>● 8+ characters</span><span className={passwordChecks.upper?'valid':''}>● Capital letter</span><span className={passwordChecks.number?'valid':''}>● Number</span><span className={password&&password===confirmPassword?'valid':''}>● Passwords match</span></div></>}<Button type="submit" disabled={busy}>{busy?'Please wait…':signup?'Create account':'Sign in'}</Button></form><div className="auth-switch"><span>{signup?'Already have an account?':'New to Waypoint?'}</span><Button variant="ghost" onClick={()=>{setSignup(v=>!v);setMessage('')}}>{signup?'Sign in':'Create an account'}</Button></div><Button variant="ghost" disabled={!email||busy} onClick={()=>void submit(true)}>Send a magic link</Button>{message&&<p role="status" className="info-banner">{message}</p>}<div className="auth-trust"><ShieldCheck size={16}/><span>Your workspace is protected by Supabase Auth.</span></div>{demo&&<Link className="btn secondary" to="/dashboard">Explore the demo workspace</Link>}</div></div>;
}
