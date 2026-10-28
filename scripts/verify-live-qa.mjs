import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(line => line.includes('=')).map(line => {
  const i = line.indexOf('=');
  return [line.slice(0,i), line.slice(i+1).replace(/^"|"$/g,'')];
}));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
assert(url?.includes('enebrcdrdnfkyduzyrzm'), 'Wrong project');
const client = () => createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin = client();
const created = [];
const report = [];
assert(process.env.AUTOPILOT_QA_ADMIN_EMAIL && process.env.AUTOPILOT_QA_ADMIN_PASSWORD, 'Set AUTOPILOT_QA_ADMIN_EMAIL and AUTOPILOT_QA_ADMIN_PASSWORD; credentials are never written to the repository.');
const stamp = Date.now();
const checkpoint = `/tmp/autopilot-qa-${stamp}.json`;
const requireResult = (result,label) => { if(result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
const pass = label => { report.push(label); console.log(`PASS ${label}`); };
const login = async credentials => {
  const c = client();
  requireResult(await c.auth.signInWithPassword(credentials),'sign in');
  return c;
};
const create = async (kind,label) => {
  const email=`qa-${stamp}-${label}@autopilotplan.com`;
  const data = requireResult(await admin.functions.invoke('admin-create-test-account',{body:{email,name:`[QA temporal] ${label}`,kind}}),'create fixture');
  assert(data.profile?.user_id && data.password,'Missing fixture');
  const fixture={id:data.profile.user_id,email,password:data.password,label};
  created.push(fixture);
  writeFileSync(checkpoint,JSON.stringify(created.map(({id,email,label})=>({id,email,label}))),{mode:0o600});
  fixture.api=await login({email,password:data.password});
  return fixture;
};
let failure;
try {
  requireResult(await admin.auth.signInWithPassword({email:process.env.AUTOPILOT_QA_ADMIN_EMAIL,password:process.env.AUTOPILOT_QA_ADMIN_PASSWORD}),'admin sign in');
  assert.equal(requireResult(await admin.rpc('has_role',{_user_id:(await admin.auth.getUser()).data.user.id,_role:'admin'}),'admin role'),true);
  const coach=await create('client_full','coach');
  const plus=await create('client_training','plus');
  const trainerA=await create('trainer','trainer-a');
  const trainerB=await create('trainer','trainer-b');
  requireResult(await admin.rpc('admin_assign_user_to_trainer',{_trainer_id:trainerA.id,_email:coach.email}),'assign client');
  const assigned=requireResult(await trainerA.api.rpc('get_trainer_assigned_profiles'),'trainer profiles');
  assert(assigned.some(p=>p.user_id===coach.id));
  assert(assigned.every(p=>!p.stripe_payment_id || p.stripe_payment_id==='configured'));
  assert(!requireResult(await trainerB.api.rpc('get_trainer_assigned_profiles'),'other trainer profiles').some(p=>p.user_id===coach.id));
  pass('assigned client visible only to assigned trainer; Stripe ID masked');
  const days=[{day:'Lunes',type:'gimnasio',routine_name:'QA persistence',exercises:[{exercise_id:'qa',name:'QA sentadilla',series:2,reps:8,weight:'30',rest:'60s'}]}];
  requireResult(await trainerA.api.from('training_plan').upsert({user_id:coach.id,workouts_json:days},{onConflict:'user_id'}),'save plan');
  const fresh=await login({email:coach.email,password:coach.password});
  assert.deepEqual(requireResult(await fresh.from('training_plan').select('workouts_json').eq('user_id',coach.id).single(),'reload plan').workouts_json,days);
  assert.equal(requireResult(await trainerB.api.from('training_plan').select('user_id').eq('user_id',coach.id),'isolation').length,0);
  const badWrite=await trainerB.api.from('training_plan').update({workouts_json:[]}).eq('user_id',coach.id).select('user_id');
  assert(badWrite.error || badWrite.data.length===0);
  assert.deepEqual(requireResult(await fresh.from('training_plan').select('workouts_json').eq('user_id',coach.id).single(),'plan unchanged').workouts_json,days);
  pass('routine persists through new session; unrelated trainer cannot read or change it');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sets=[{reps:8,weight:'30',done:true},{reps:8,weight:'30',done:true}];
  requireResult(await fresh.from('workout_logs').upsert({user_id:coach.id,day_label:'Lunes',exercise_name:'QA sentadilla',sets_completed:sets,logged_at:date,rpe:7},{onConflict:'user_id,day_label,logged_at,exercise_name'}),'save workout');
  requireResult(await fresh.from('day_completions').upsert({user_id:coach.id,day_label:'Lunes',completed_at:date,rpe:7},{onConflict:'user_id,day_label,completed_at'}),'save completion');
  const reloaded=await login({email:coach.email,password:coach.password});
  const log=requireResult(await reloaded.from('workout_logs').select('sets_completed,logged_at,day_label').eq('user_id',coach.id).single(),'reload workout');
  assert.deepEqual(log.sets_completed,sets); assert.equal(log.logged_at,date); assert.equal(log.day_label,'Lunes');
  assert.equal(requireResult(await reloaded.from('day_completions').select('completed_at').eq('user_id',coach.id).single(),'reload completion').completed_at,date);
  assert.equal(requireResult(await trainerB.api.from('workout_logs').select('id').eq('user_id',coach.id),'private workouts').length,0);
  pass('sets and completion persist on actual Madrid date independently of routine weekday');
  requireResult(await fresh.from('chat_messages').insert({conversation_user_id:coach.id,sender_id:coach.id,content:'[QA temporal] mensaje cliente'}),'client message');
  requireResult(await trainerA.api.from('chat_messages').insert({conversation_user_id:coach.id,sender_id:trainerA.id,content:'[QA temporal] respuesta entrenador'}),'trainer reply');
  assert.equal(requireResult(await reloaded.from('chat_messages').select('content').eq('conversation_user_id',coach.id),'reload chat').length,2);
  assert.equal(requireResult(await trainerB.api.from('chat_messages').select('id').eq('conversation_user_id',coach.id),'private chat').length,0);
  assert((await trainerB.api.from('chat_messages').insert({conversation_user_id:coach.id,sender_id:trainerB.id,content:'[QA temporal] acceso denegado'})).error);
  requireResult(await trainerA.api.from('chat_messages').insert({conversation_user_id:trainerA.id,sender_id:trainerA.id,content:'[QA temporal] interno'}),'internal chat');
  assert.equal(requireResult(await fresh.from('chat_messages').select('id').eq('conversation_user_id',trainerA.id),'separate internal chat').length,0);
  pass('client/trainer conversation persists; internal conversation separate; unrelated trainer denied');
  assert((await plus.api.from('chat_messages').insert({conversation_user_id:plus.id,sender_id:plus.id,content:'[QA temporal] plus denied'})).error);
  requireResult(await admin.from('profiles').update({payment_status:'unpaid',subscription_status:null,subscription_tier:null}).eq('user_id',plus.id),'set QA free');
  assert((await plus.api.from('chat_messages').insert({conversation_user_id:plus.id,sender_id:plus.id,content:'[QA temporal] free denied'})).error);
  pass('Plus and Free cannot write human-coach chat');
  assert((await fresh.from('nutrition_plan').insert({user_id:coach.id,macros_json:{protein:-1,carbs:200,fats:70,calories:2030},meals_json:[]})).error);
  requireResult(await trainerA.api.from('nutrition_plan').upsert({user_id:coach.id,macros_json:{protein:150,carbs:200,fats:70,calories:2030},meals_json:[{name:'QA',description:'fixture'}]},{onConflict:'user_id'}),'save valid nutrition');
  assert.equal(requireResult(await reloaded.from('nutrition_plan').select('macros_json').eq('user_id',coach.id).single(),'reload nutrition').macros_json.calories,2030);
  pass('nutrition rejects invalid new macros and persists valid ones');
  assert.equal(requireResult(await plus.api.rpc('get_payment_mode'),'payment mode'),'test');
  for (const plan of ['plus','coach']) {
    const checkout=requireResult(await plus.api.functions.invoke('create-checkout',{body:{plan}}),'checkout');
    const paymentUrl=new URL(checkout.url);
    assert.equal(paymentUrl.hostname,'buy.stripe.com'); assert(paymentUrl.pathname.startsWith('/test_'));
    assert.equal(paymentUrl.searchParams.get('client_reference_id'),plus.id);
  }
  const afterCheckout=requireResult(await plus.api.from('profiles').select('payment_status,subscription_tier').eq('user_id',plus.id).single(),'checkout does not grant access');
  assert.notEqual(afterCheckout.payment_status,'paid');
  pass('Plus/Coach return Stripe test links with correct client; checkout alone grants no access');
} catch(error) { failure=error; console.error('FAIL',error.message); }
finally {
  const cleanup=[];
  for(const fixture of [...created].reverse()) {
    const result=await admin.functions.invoke('admin-delete-user',{body:{target_user_id:fixture.id}});
    if(result.error) cleanup.push(fixture);
  }
  if(cleanup.length) {
    writeFileSync(checkpoint,JSON.stringify(cleanup.map(({id,email,label})=>({id,email,label}))),{mode:0o600});
    console.error(`CLEANUP PENDING: ${cleanup.length} fixtures; private checkpoint ${checkpoint}`);
    failure ||= new Error('Fixture cleanup incomplete');
  } else {
    try { unlinkSync(checkpoint); } catch { /* No fixture created. */ }
    pass('temporary accounts removed');
  }
  writeFileSync(process.env.AUTOPILOT_QA_REPORT_PATH || `/tmp/autopilot-live-results-${stamp}.json`,JSON.stringify({time:new Date().toISOString(),passed:report,failure:failure?.message||null},null,2));
}
if(failure)process.exitCode=1;
