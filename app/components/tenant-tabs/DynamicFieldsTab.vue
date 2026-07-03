<template>
  <section class="rf-tab-shell">
    <div class="rf-tab-intro">
      <div class="rf-tab-intro__badge rf-tab-intro__badge--blue">Dynamic Variables</div>
      <h2 class="rf-tab-intro__title">Configure template merge fields</h2>
      <p class="rf-tab-intro__text">
        Dynamic variables define allowed template tokens for this tenant. Use
        <strong>key</strong> as the token path (e.g. <code>user.firstName</code>), then map it to a
        contact <strong>path</strong> (e.g. <code>firstName</code>, <code>lastName</code>, or
        <code>address.state</code>). Templates use mustache syntax like
        <code v-pre>{{user.firstName}}</code>.
      </p>
    </div>

    <div class="rf-tab-content">
      <slot />
    </div>
  </section>
</template>
