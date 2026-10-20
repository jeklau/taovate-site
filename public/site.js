// 站点公共脚本（同步加载，体积很小）。
// 先给 <html> 加 .js 类：只有脚本成功运行时，.reveal 元素才会先隐藏再渐入；
// 脚本加载失败或被禁用时，页面内容保持可见。
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
});
