const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// 加载环境变量（必须在其他代码之前）
dotenv.config({ path: '.env' });

const app = express();
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());

// 验证环境变量是否加载成功
console.log('环境变量测试:', {
  email: process.env.EMAIL_USER ? '已设置' : '未设置',
  db: process.env.DB_NAME ? '已设置' : '未设置'
});

// 数据库连接
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '@Aa123456',
  database: process.env.DB_NAME || 'studentinfo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 验证码存储
const verificationCodes = {};

// 邮件配置（使用环境变量）
const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,  // 使用环境变量
    pass: process.env.EMAIL_PASS   // 使用环境变量
  },
  tls: {
    rejectUnauthorized: false
  }
});

// 测试邮件配置
transporter.verify((error) => {
  if (error) {
    console.error('邮件服务器连接失败:', error);
  } else {
    console.log('邮件服务器已准备好');
  }
});

// 数据库连接检查
pool.getConnection((err, connection) => {
  if (err) {
    console.error('数据库连接错误:', err);
    return;
  }
  console.log('数据库连接成功');
  connection.release();
});

// 生成6位验证码
function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// 发送验证码
app.post('/api/send-verification', async (req, res) => {
  const { email } = req.body;
  
  // 验证QQ邮箱格式
  const qqEmailRegex = /^[1-9][0-9]{4,10}@qq\.com$/i;
  if (!qqEmailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: '请输入有效的QQ邮箱（如12345@qq.com）' 
    });
  }

  try {
    // 检查邮箱是否已注册
    const [rows] = await pool.promise().query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '该邮箱已被注册' 
      });
    }

    // 生成并存储验证码
    const code = generateVerificationCode();
    verificationCodes[email] = {
      code,
      expiresAt: Date.now() + 300000 // 5分钟有效期
    };

    // 发送邮件
    await transporter.sendMail({
      from: `"系统管理员" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '注册验证码',
      text: `您的验证码是：${code}，5分钟内有效。`,
      html: `<b>${code}</b> <p>您的验证码，5分钟内有效</p>`
    });
    
    res.json({ 
      success: true, 
      message: '验证码已发送' 
    });
  } catch (error) {
    console.error('发送验证码失败详情:', {
      error: error.response || error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      success: false, 
      message: '发送验证码失败，请稍后重试'
    });
  }
});

// 注册接口
app.post('/api/register', async (req, res) => {
  const { email, username, password, verificationCode } = req.body;

  // 参数验证
  if (!email || !username || !password || !verificationCode) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }

  // 验证验证码
  const record = verificationCodes[email];
  if (!record || record.code !== verificationCode) {
    return res.status(400).json({ 
      success: false, 
      message: '验证码错误' 
    });
  }
  
  if (Date.now() > record.expiresAt) {
    return res.status(400).json({ 
      success: false, 
      message: '验证码已过期' 
    });
  }

  try {
    // 密码加密
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // 插入用户数据
    const [result] = await pool.promise().query(
      'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, email, 'student']
    );
    
    // 清除验证码
    delete verificationCodes[email];
    
    res.json({ 
      success: true, 
      message: '注册成功',
      userId: result.insertId 
    });
  } catch (error) {
    console.error('注册失败详情:', {
      code: error.code,
      sqlMessage: error.sqlMessage
    });
    
    if (error.code === 'ER_DUP_ENTRY') {
      const field = error.message.includes('username') ? '用户名' : '邮箱';
      return res.status(409).json({
        success: false,
        message: `${field}已存在`
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: '注册失败，请稍后重试' 
    });
  }
});

// 登录接口
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // 参数验证
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '用户名和密码不能为空'
    });
  }

  try {
    const [rows] = await pool.promise().query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: '密码错误' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '登录失败，请稍后重试' 
    });
  }
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});