retry_policy CalibrationNetworkRetry {
  max_retries 2
  strategy {
    type exponential_backoff
    delay_ms 500
    multiplier 2.0
    max_delay_ms 4000
  }
}

client<llm> RuntimePrimary {
  provider openai-generic
  retry_policy CalibrationNetworkRetry
  options {
    base_url "https://api.openai.com/v1"
    model "gpt-4o-mini"
    api_key env.OPENAI_API_KEY
  }
}
