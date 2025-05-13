<template>
  <div class="register-container">
    <el-card class="register-card">
      <template #header>
        <h2>注册账号</h2>
      </template>
      
      <el-form :model="form" @submit.prevent="handleRegister">
        <el-form-item>
          <el-input
            v-model="form.email"
            placeholder="QQ邮箱"
            prefix-icon="Message"
            @blur="validateEmail"
          />
        </el-form-item>
        
        <el-form-item>
          <div class="verification-code-container">
            <el-input
              v-model="form.verificationCode"
              placeholder="验证码"
              prefix-icon="Key"
              style="width: 60%"
            />
            <el-button 
              type="primary" 
              :disabled="!isEmailValid || isCountingDown"
              @click="sendVerificationCode"
              style="width: 38%; margin-left: 2%"
            >
              {{ countdown > 0 ? `${countdown}秒后重试` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="用户名"
            prefix-icon="User"
          />
        </el-form-item>
        
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="确认密码"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" native-type="submit" block>注册</el-button>
        </el-form-item>
        
        <div class="register-links">
          <router-link to="/login">返回登录</router-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()

const form = reactive({
  email: '',
  verificationCode: '',
  username: '',
  password: '',
  confirmPassword: ''
})

const isEmailValid = ref(false)
const countdown = ref(0)
const isCountingDown = ref(false)
const storedVerificationCode = ref('')

const validateEmail = () => {
  const qqEmailRegex = /^[1-9][0-9]{4,10}@qq\.com$/i
  isEmailValid.value = qqEmailRegex.test(form.email)
  if (!isEmailValid.value && form.email) {
    ElMessage.error('请输入有效的QQ邮箱')
  }
}

const sendVerificationCode = async () => {
  if (!isEmailValid.value) {
    ElMessage.error('请输入有效的QQ邮箱')
    return
  }

  try {
    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    storedVerificationCode.value = code
    
    // In a real application, you would send this to your backend which would then email it
    // For demo purposes, we'll just log it and simulate sending
    console.log(`Verification code for ${form.email}: ${code}`)
    
    // Simulate API call to send email
    await axios.post('http://localhost:3000/api/send-verification', {
      email: form.email,
      code: code
    })
    
    // Start countdown
    countdown.value = 60
    isCountingDown.value = true
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        isCountingDown.value = false
      }
    }, 1000)
    
    ElMessage.success('验证码已发送')
  } catch (error) {
    ElMessage.error('发送验证码失败，请稍后重试')
  }
}

const handleRegister = async () => {
  // 移除前端验证码验证，完全交给后端
  
  if (form.password !== form.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }

  try {
    const response = await axios.post('http://localhost:3000/api/register', {
      email: form.email,
      username: form.username,
      password: form.password,
      verificationCode: form.verificationCode // 添加这行
    })
    
    if (response.data.success) {
      ElMessage.success('注册成功')
      router.push('/login')
    } else {
      ElMessage.error(response.data.message)
    }
  } catch (error) {
    // 显示更详细的错误信息
    if (error.response) {
      ElMessage.error(error.response.data.message || '注册失败')
    } else {
      ElMessage.error('网络错误，请检查连接')
    }
  }
}

</script>

<style scoped>
.register-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
}

.register-card {
  width: 400px;
}

.register-card :deep(.el-card__header) {
  text-align: center;
}

.register-links {
  text-align: center;
  margin-top: 16px;
}

.register-links a {
  color: #409eff;
  text-decoration: none;
}

.register-links a:hover {
  color: #66b1ff;
}

.verification-code-container {
  display: flex;
  justify-content: space-between;
  width: 100%;
}
</style>