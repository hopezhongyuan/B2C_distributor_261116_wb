<template>
  <t-tag :theme="meta[1]" size="small" :class="{ 'status-void': voided }">{{ meta[0] }}</t-tag>
</template>

<script setup>
import { computed } from 'vue';

// ProStatusTag — 状态值→文案/颜色统一映射（ui-spec §3.5 表为唯一来源，禁止页面自配）
const DOMAINS = {
  order: {
    PENDING_PAY: ['待付款', 'warning'],
    PAID: ['已支付', 'primary'],
    DELIVERED: ['已发货', 'primary'],
    COMPLETED: ['已完成', 'success'],
    REDEEMED: ['已核销', 'success'],
    CLOSED: ['已关闭', 'default'],
    REFUNDING: ['退款中', 'warning'],
    REFUNDED: ['已退款', 'default'],
    PARTIAL_REFUNDED: ['部分退款', 'warning']
  },
  commission: {
    FROZEN: ['冻结中', 'default'],
    AVAILABLE: ['可提现', 'success'],
    WITHDRAWING: ['提现中', 'warning'],
    PAID: ['已提现', 'primary'],
    VOID: ['已作废', 'default']
  },
  refund: {
    PENDING: ['待审核', 'warning'],
    APPROVED: ['已通过', 'primary'],
    REFUNDED: ['已退款', 'success'],
    REJECTED: ['已拒绝', 'danger'],
    FAILED: ['打款失败', 'danger']
  },
  withdraw: {
    pending: ['待审核', 'warning'],
    approved: ['待打款', 'primary'],
    paid: ['已打款', 'success'],
    rejected: ['已拒绝', 'danger'],
    failed: ['打款失败', 'danger']
  },
  product: {
    draft: ['草稿', 'default'],
    on: ['上架中', 'success'],
    off: ['已下架', 'warning']
  },
  distributor: {
    active: ['正常', 'success'],
    banned: ['已禁用', 'danger']
  }
};

const props = defineProps({
  domain: { type: String, required: true },
  value: { type: String, default: '' }
});

const meta = computed(() => (DOMAINS[props.domain] || {})[props.value] || [props.value || '—', 'default']);
const voided = computed(() => props.domain === 'commission' && props.value === 'VOID');
</script>
