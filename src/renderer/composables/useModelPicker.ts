import { useAppStore } from '@/stores/app'

const KNOWN_MODELS = [
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4.5', label: 'Claude Opus 4.5' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.1', label: 'GPT-5.1' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' }
]

export function useModelPicker() {
  const store = useAppStore()

  async function selectModel(modelId: string): Promise<void> {
    const session = store.activeSession
    if (!session) return

    await window.api.model.set(session.ptyId, modelId)
    store.setModel(modelId)
  }

  return {
    models: KNOWN_MODELS,
    selectedModel: store.selectedModel,
    selectModel
  }
}
