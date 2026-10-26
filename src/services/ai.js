import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export async function generateAI(prompt, image) {
  if (!auth().currentUser) {
    throw new Error('Vui lòng đăng nhập để sử dụng trợ lý AI.');
  }
  const generate = functions().httpsCallable('generateAI', { timeout: 90000 });
  const request = image === undefined ? { prompt } : { prompt, image };
  const response = await generate(request);
  return response.data;
}
