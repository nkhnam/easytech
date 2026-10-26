const mockGenerate = jest.fn();
const mockHttpsCallable = jest.fn(() => mockGenerate);
const mockSession = { currentUser: null };

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => mockSession,
}));
jest.mock('@react-native-firebase/functions', () => ({
  __esModule: true,
  default: () => ({ httpsCallable: mockHttpsCallable }),
}));

import { generateAI } from '../src/services/ai';

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.currentUser = null;
});

test('signed-out native session does not call the backend', async () => {
  await expect(generateAI('Advice')).rejects.toThrow('đăng nhập');
  expect(mockHttpsCallable).not.toHaveBeenCalled();
});

test('signed-in native session forwards the image to the callable', async () => {
  mockSession.currentUser = { uid: 'user-1' };
  mockGenerate.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: 'Advice' }] } }] } });
  const result = await generateAI('Verify task', 'image-data');
  expect(mockHttpsCallable).toHaveBeenCalledWith('generateAI', { timeout: 90000 });
  expect(mockGenerate).toHaveBeenCalledWith({ prompt: 'Verify task', image: 'image-data' });
  expect(result.candidates[0].content.parts[0].text).toBe('Advice');
});

test('text-only requests omit the optional image field', async () => {
  mockSession.currentUser = { uid: 'user-1' };
  mockGenerate.mockResolvedValue({ data: { candidates: [] } });
  await generateAI('Advice');
  expect(mockGenerate).toHaveBeenCalledWith({ prompt: 'Advice' });
});
