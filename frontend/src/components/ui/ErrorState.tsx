import { Button } from './Button'
import { Card } from './Card'
import { StatusBadge } from './StatusBadge'

type Props = {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: Props) {
  return (
    <Card padding="lg" tone="risk">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2">
            <StatusBadge tone="risk" dot>
              Action needed
            </StatusBadge>
          </div>
          <h2 className="font-bold text-red-900 dark:text-red-200">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-red-800/90 dark:text-red-300/90">{message}</p>
        </div>
        {onRetry && (
          <Button type="button" variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </Card>
  )
}
