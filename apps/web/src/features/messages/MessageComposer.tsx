import { Button } from 'ui';
import { useTranslation } from '../../core/i18n';

export function MessageComposer({
  value,
  onChange,
  onSendMessage,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSendMessage: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <form
      className="grid grid-cols-[1fr_42px] items-center gap-2.5 border-t border-border p-[15px] max-md:px-0 max-md:py-[11px]"
      onSubmit={(event) => {
        event.preventDefault();
        onSendMessage();
      }}
    >
      <label className="sr-only" htmlFor="message-composer-input">
        {t('messages.composer.label')}
      </label>
      <textarea
        className="min-h-12 max-h-28 resize-y rounded-sm border border-border px-[14px] py-3"
        id="message-composer-input"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            onSendMessage();
          }
        }}
        placeholder={t('messages.composer.placeholder')}
        rows={1}
        value={value}
      />
      <Button
        className="!min-w-[42px] !p-0"
        aria-label={t('messages.composer.send')}
        disabled={disabled}
        type="submit"
      >
        →
      </Button>
    </form>
  );
}
