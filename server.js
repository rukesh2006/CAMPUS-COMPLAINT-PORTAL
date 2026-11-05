require('dotenv').config();
const express=require('express');
const mysql=require('mysql2/promise');
const bcrypt=require('bcryptjs');
const session=require('express-session');
const MySQLStore=require('express-mysql-session')(session);
const path=require('path');

const app=express();
const port=Number(process.env.PORT)||3000;
const dbOptions={host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'campus_complaints',waitForConnections:true,connectionLimit:10,queueLimit:0};
const pool=mysql.createPool(dbOptions);
app.disable('x-powered-by');
app.use(express.json({limit:'20kb'}));
app.use(session({name:'campus.sid',secret:process.env.SESSION_SECRET||'change-this-before-deployment',resave:false,saveUninitialized:false,store:new MySQLStore({ ...dbOptions, clearExpired:true, checkExpirationInterval:15*60*1000, expiration:8*60*60*1000 }),cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}}));
app.use(express.static(__dirname));

function cleanUser(row,role){return role==='management'?{id:row.id,name:row.name,email:row.email,role}:{id:row.id,name:row.name,regNo:row.reg_no,role};}
function asyncRoute(fn){return(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next)}
function requireAuth(req,res,next){if(!req.session.user)return res.status(401).json({error:'Please sign in to continue.'});next()}
function requireManagement(req,res,next){if(!req.session.user||req.session.user.role!=='management')return res.status(403).json({error:'Management access is required.'});next()}
app.get('/api/health',asyncRoute(async(req,res)=>{await pool.query('SELECT 1');res.json({ok:true})}));
app.get('/api/auth/me',(req,res)=>res.json({user:req.session.user||null}));
app.post('/api/auth/register',asyncRoute(async(req,res)=>{
  const regNo=String(req.body.regNo||'').trim().toUpperCase(),password=String(req.body.password||''),name=String(req.body.name||'').trim();
  if(!/^[A-Z0-9-]{4,24}$/.test(regNo))return res.status(400).json({error:'Enter a valid registration number (4–24 letters or numbers).'});
  if(password.length<8||password.length>72)return res.status(400).json({error:'Choose a password between 8 and 72 characters.'});
  if(!name||name.length>100)return res.status(400).json({error:'Enter your name (up to 100 characters).'});
  const hash=await bcrypt.hash(password,12);
  try{const [result]=await pool.execute('INSERT INTO students (reg_no,name,password_hash) VALUES (?,?,?)',[regNo,name,hash]);const user={id:result.insertId,name,regNo,role:'student'};req.session.user=user;res.status(201).json({user})}catch(e){if(e.code==='ER_DUP_ENTRY')return res.status(409).json({error:'An account already exists for that registration number.'});throw e}
}));
app.post('/api/auth/login',asyncRoute(async(req,res)=>{
  const role=req.body.role==='management'?'management':'student',identity=String(role==='management'?req.body.email:req.body.regNo||'').trim();
  const password=String(req.body.password||'');if(!identity||!password)return res.status(400).json({error:'Enter your login details.'});
  const [rows]=role==='management'?await pool.execute('SELECT id,name,email,password_hash FROM management_users WHERE email=?',[identity.toLowerCase()]):await pool.execute('SELECT id,name,reg_no,password_hash FROM students WHERE reg_no=?',[identity.toUpperCase()]);
  if(!rows.length||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:'Those login details don’t match our records.'});
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Unable to start a secure session.'});const user=cleanUser(rows[0],role);req.session.user=user;req.session.save(e=>e?res.status(500).json({error:'Unable to save your session.'}):res.json({user}))});
}));
app.post('/api/auth/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('campus.sid');res.json({ok:true})}));
app.get('/api/complaints',requireAuth,asyncRoute(async(req,res)=>{
  const management=req.session.user.role==='management';
  const sql=`SELECT c.id,c.student_id,c.title,c.category,c.priority,c.description,c.status,c.reply,c.created_at,c.updated_at,s.name AS student_name,s.reg_no FROM complaints c JOIN students s ON s.id=c.student_id ${management?'':'WHERE c.student_id=?'} ORDER BY c.created_at DESC`;
  const [rows]=management?await pool.query(sql):await pool.execute(sql,[req.session.user.id]);
  res.json({complaints:rows.map(r=>({id:r.id,title:r.title,category:r.category,priority:r.priority,description:r.description,status:r.status,reply:r.reply,createdAt:r.created_at,updatedAt:r.updated_at,studentName:r.student_name,regNo:r.reg_no}))});
}));
app.post('/api/complaints',requireAuth,asyncRoute(async(req,res)=>{
  if(req.session.user.role!=='student')return res.status(403).json({error:'Only students can raise complaints.'});
  const title=String(req.body.title||'').trim(),category=String(req.body.category||''),priority=String(req.body.priority||'Normal'),description=String(req.body.description||'').trim();
  const categories=['Hostel','Facilities','Academics','IT & Wi-Fi','Transport','Safety','Other'];
  if(title.length<4||title.length>160)return res.status(400).json({error:'Subject must be between 4 and 160 characters.'});
  if(!categories.includes(category))return res.status(400).json({error:'Choose a valid complaint category.'});
  if(!['Normal','High','Urgent'].includes(priority))return res.status(400).json({error:'Choose a valid priority.'});
  if(description.length<10||description.length>5000)return res.status(400).json({error:'Description must be between 10 and 5,000 characters.'});
  const [result]=await pool.execute('INSERT INTO complaints (student_id,title,category,priority,description) VALUES (?,?,?,?,?)',[req.session.user.id,title,category,priority,description]);
  res.status(201).json({id:result.insertId});
}));
app.patch('/api/complaints/:id/status',requireManagement,asyncRoute(async(req,res)=>{
  const status=String(req.body.status||'');if(!['Open','In progress','Resolved'].includes(status))return res.status(400).json({error:'Choose a valid status.'});
  const [result]=await pool.execute('UPDATE complaints SET status=? WHERE id=?',[status,req.params.id]);if(!result.affectedRows)return res.status(404).json({error:'Complaint not found.'});res.json({ok:true});
}));
app.post('/api/complaints/:id/reply',requireManagement,asyncRoute(async(req,res)=>{
  const reply=String(req.body.reply||'').trim();if(reply.length<2||reply.length>3000)return res.status(400).json({error:'Reply must be between 2 and 3,000 characters.'});
  const [result]=await pool.execute('UPDATE complaints SET reply=?,status=IF(status=\'Open\',\'In progress\',status) WHERE id=?',[reply,req.params.id]);if(!result.affectedRows)return res.status(404).json({error:'Complaint not found.'});res.json({ok:true});
}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Something went wrong. Please try again.'})});
app.listen(port,()=>console.log(`CampusCare running at http://localhost:${port}`));
