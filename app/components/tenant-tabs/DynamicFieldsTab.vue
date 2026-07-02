<template>
  <section class="dv-shell">
    <div class="dv-intro">
      <div class="dv-intro__badge">Dynamic Variables</div>
      <h2 class="dv-intro__title">Configure template merge fields</h2>
      <p class="dv-intro__text">
        Dynamic variables define allowed template tokens for this tenant. Use
        <strong>key</strong> as the token path (e.g. <code>user.firstName</code>), then map it to a
        contact <strong>path</strong> (e.g. <code>firstName</code>, <code>lastName</code>, or
        <code>address.state</code>). Templates use mustache syntax like
        <code v-pre>{{user.firstName}}</code>.
      </p>
    </div>

    <div class="dv-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.dv-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dv-intro {
  border: 1px solid #e2e8f0;
  border-radius: 0.9rem;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  padding: 1rem 1.15rem;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}

.dv-intro__badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.18rem 0.5rem;
  margin-bottom: 0.45rem;
}

.dv-intro__title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  line-height: 1.3;
  color: #0f172a;
}

.dv-intro__text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: #475569;
}

.dv-intro__text code {
  font-size: 0.875em;
  border-radius: 0.25rem;
  background: #f1f5f9;
  padding: 0.05rem 0.3rem;
}

.dv-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>
