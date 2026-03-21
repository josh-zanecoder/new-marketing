export function useSubmitting() {
  const isSubmitting = ref(false)

  function startSubmitting() {
    isSubmitting.value = true
  }

  function stopSubmitting() {
    isSubmitting.value = false
  }

  return {
    isSubmitting,
    startSubmitting,
    stopSubmitting
  }
}

