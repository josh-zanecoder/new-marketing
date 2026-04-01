<template>
  <div class="filters-tab">
    <div class="filters-intro">
      <p>
        Dynamic variables define allowed template tokens for this tenant. Use
        <strong>key</strong> as the token path (e.g. <code>user.firstName</code>), then map it to a
        contact <strong>path</strong> (e.g. <code>firstName</code>, <code>lastName</code>, or <code>address.state</code>). Templates use
        mustache syntax like <code v-pre>{{user.firstName}}</code>.
      </p>
    </div>

    <slot />
  </div>
</template>
