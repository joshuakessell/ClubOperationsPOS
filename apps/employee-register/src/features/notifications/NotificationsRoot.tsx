import { SuccessToast } from '../../components/register/toasts/SuccessToast';
import { BottomToastStack } from '../../components/register/toasts/BottomToastStack';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';

export function NotificationsRoot() {
  const {
    successToastMessage,
    setSuccessToastMessage,
    bottomToasts,
    dismissBottomToast,
  } = useEmployeeRegisterState();

  return (
    <>
      <SuccessToast message={successToastMessage} onDismiss={() => setSuccessToastMessage(null)} />
      <BottomToastStack toasts={bottomToasts} onDismiss={dismissBottomToast} />
    </>
  );
}
