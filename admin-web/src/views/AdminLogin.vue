<template>
  <div class="login-page">
    <t-card class="login-card" title="分销商城管理后台">
      <t-form ref="form" :data="formData" :rules="rules" @submit="onSubmit">
        <t-form-item label="账号" name="username">
          <t-input v-model="formData.username" placeholder="管理员账号" clearable />
        </t-form-item>
        <t-form-item label="密码" name="password">
          <t-input v-model="formData.password" type="password" placeholder="密码" clearable />
        </t-form-item>
        <t-button type="submit" block :loading="loading">登录</t-button>
      </t-form>
      <p class="tip">管理员账号由服务器脚本创建：node scripts/create-admin.js</p>
    </t-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';
import { setToken } from '../auth';

const router = useRouter();
const loading = ref(false);
const formData = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号' }],
  password: [{ required: true, message: '请输入密码' }]
};

async function onSubmit({ validateResult }) {
  if (validateResult !== true) return;
  loading.value = true;
  try {
    // 对应 docs/api/admin.md 契约（M4 实现）：POST /api/admin/login
    const data = await http.post('/admin/login', formData);
    setToken(data.token);
    router.push('/');
  } catch (e) {
    MessagePlugin.error(e.msg || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f6f7;
}
.login-card {
  width: 360px;
}
.tip {
  margin-top: 12px;
  color: #999;
  font-size: 12px;
  text-align: center;
}
</style>
