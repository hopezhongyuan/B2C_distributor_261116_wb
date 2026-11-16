<template>
  <t-card>
    <t-empty :description="title + '功能将在对应里程碑实现'" />
  </t-card>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const title = computed(() => route.meta.title || '该模块');
</script>
