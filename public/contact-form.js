// ===== 询盘表单配置 =====
// 把表单接收地址填在这里：表单服务（如 Formspree：https://formspree.io/f/xxxxxxxx）
// 或你自己的 Worker 接口（如 /api/contact）。
// 留空 = 表单未开通：提交时会提示访客改发邮件，不会假装发送成功。
// 注意：填外部域名时，必须同时把该域名加进 public/_headers 里的 connect-src，
//       否则浏览器会拦截请求（npm run check 会检查这一点）。
window.FORM_ENDPOINT = window.FORM_ENDPOINT || '';

(function () {
  const MAIL = 'hello@taovate.com';
  const zh = document.documentElement.lang.toLowerCase().startsWith('zh');
  const T = zh
    ? {
        need: '请填写姓名和邮箱，方便我们回复你。',
        badEmail: '请填写有效的邮箱地址。',
        off: `表单暂未开通，请直接发邮件到 ${MAIL}。`,
        fail: `发送失败，请稍后再试，或直接发邮件到 ${MAIL}。`,
      }
    : {
        need: 'Please add your name and email so we can reply.',
        badEmail: 'Please enter a valid email address.',
        off: `The form is not active yet. Please email ${MAIL} directly.`,
        fail: `Something went wrong. Please try again, or email ${MAIL} directly.`,
      };

  window.contactForm = function contactForm() {
    return {
      f: { name: '', company: '', email: '', website: '', industry: '', need: '', message: '', _gotcha: '' },
      loading: false,
      error: '',
      done: false,
      async submit() {
        this.error = '';
        if (!this.f.name.trim() || !this.f.email.trim()) { this.error = T.need; return; }
        if (!/^\S+@\S+\.\S+$/.test(this.f.email.trim())) { this.error = T.badEmail; return; }
        if (this.f._gotcha) { this.done = true; return; } // 蜜罐被填：机器人，静默丢弃
        if (!window.FORM_ENDPOINT) { this.error = T.off; return; }
        this.loading = true;
        try {
          const r = await fetch(window.FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(this.f),
          });
          if (!r.ok) throw new Error('bad response ' + r.status);
          this.done = true;
        } catch (e) {
          this.error = T.fail;
        } finally {
          this.loading = false;
        }
      },
    };
  };
})();
