import { useAuth } from '@clerk/expo';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { Button, Screen, Text } from '@/components/ui';
import { CancelBeforeDelete } from '@/features/integrations/components';
import { getDeletion, requestDeletion } from '@/features/usage/hooks';
import { DELETION_STATUS, deletionConfirmed, deleteThenSignOut } from '@/features/usage/logic';
import { messageFor } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<keyof typeof DELETION_STATUS | null>(null);
  const remove = async () => {
    if (!deletionConfirmed(step, text)) return;
    setBusy(true); setProblem(null);
    let receiptAccepted = false;
    try { await deleteThenSignOut(requestDeletion, (r) => { receiptAccepted = true; setAccepted(true); setStatus(r.status); }, () => signOut()); }
    catch (e) { setProblem(receiptAccepted ? 'Đã nhận yêu cầu xóa nhưng chưa đăng xuất được. Bạn có thể đăng xuất bên dưới.' : messageFor(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen title="Xóa tài khoản">
      <Text variant="title">Bạn muốn xóa tài khoản?</Text>
      <CancelBeforeDelete />
      <Text variant="body">Tài khoản sẽ bị khóa ngay khi máy chủ nhận yêu cầu. Ảnh, tủ đồ, Lookbook, hồ sơ và tài khoản Clerk được xóa bằng tác vụ nền. Các món không thể khôi phục.</Text>
      <Text variant="body">Quá trình dọn dữ liệu có thể mất 12–20 phút hoặc lâu hơn khi nhà cung cấp gặp sự cố. Biên nhận không có nghĩa toàn bộ dữ liệu đã xóa xong. Máy chủ tiếp tục xử lý sau khi bạn đăng xuất.</Text>
      {accepted ? <><Text variant="body">Đã nhận yêu cầu xóa{status ? ` (${DELETION_STATUS[status]})` : ''}.</Text><Button label="Đăng xuất" onPress={() => signOut().catch(() => setProblem('Chưa đăng xuất được. Hãy thử lại.'))} /></> : step === 1 ? (
        <Button label="Tôi hiểu, tiếp tục xác nhận" variant="danger" onPress={() => setStep(2)} />
      ) : <><Text variant="body">Nhập chính xác XÓA để xác nhận lần hai.</Text><TextInput value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Nhập XÓA để xác nhận xóa tài khoản" placeholder="XÓA" style={{ minHeight: 52, padding: space.md, borderWidth: 1, borderColor: colors.separator, borderRadius: radius.md, color: colors.ink, fontSize: 18 }} /><Button label="Xóa tài khoản vĩnh viễn" variant="danger" loading={busy} disabled={!deletionConfirmed(step, text)} onPress={remove} /></>}
      {problem ? <><Text variant="callout" color={colors.danger} accessibilityLiveRegion="polite">{problem}</Text><Button label="Kiểm tra biên nhận" variant="plain" onPress={async () => { try { const r = await getDeletion(); setStatus(r.status); setAccepted(true); } catch (e) { setProblem(messageFor(e)); } }} /></> : null}
    </Screen>
  );
}
