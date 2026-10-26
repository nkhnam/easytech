import { generateAI } from '../../services/ai';
// ChatBot.js - Tech Support for Elderly Users with Content Reporting
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
  Dimensions,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import axios from 'axios';
import WebView from 'react-native-webview';
import TabBar from '../TabBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { UserPreferences } from '../UserPreferences';
import Header from '../Header';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Prompt template string for elderly tech support
const promptTemplateString = `
Bạn là một trợ lý AI chuyên giải đáp thắc mắc về công nghệ dành cho người cao tuổi. Bạn cần giải thích mọi thứ một cách đơn giản, rõ ràng và kiên nhẫn. Dưới đây là ngữ cảnh tài liệu bạn có thể tham khảo để đưa ra câu trả lời phù hợp:

{context}

Câu hỏi từ người dùng: {question}

Hướng dẫn trả lời:
- Sử dụng ngôn ngữ đơn giản, dễ hiểu, tránh thuật ngữ kỹ thuật phức tạp
- Giải thích từng bước một cách chi tiết và cụ thể
- Kiên nhẫn và thân thiện trong cách diễn đạt
- Đưa ra ví dụ thực tế gần gũi với cuộc sống hàng ngày
- Nếu cần dùng thuật ngữ kỹ thuật, hãy giải thích nghĩa của nó
- Khuyến khích người dùng hỏi thêm nếu chưa hiểu rõ
- Nếu câu hỏi không liên quan đến công nghệ thì nói: "Tôi chỉ trả lời các câu hỏi về công nghệ thôi ạ. Bác có thể hỏi tôi về điện thoại, máy tính, internet hay các thiết bị điện tử khác."
- Nếu người dùng chào hỏi hay trò chuyện thân thiện thì vẫn trả lời bình thường
- Luôn đảm bảo nội dung tích cực, hữu ích và phù hợp với mọi lứa tuổi
- Không cung cấp thông tin có thể gây hại hoặc không phù hợp

Luôn nhớ rằng bạn đang hỗ trợ những người có thể chưa quen thuộc với công nghệ, vì vậy hãy luôn kiên nhẫn và chu đáo.
`;

const commonQuestions = [
  'Làm sao để gọi video call với con cháu?',
  'Cách sử dụng Zalo để nhắn tin an toàn?',
  'Hướng dẫn chụp ảnh và gửi ảnh qua điện thoại',
  'Cách tải và sử dụng app ngân hàng',
  'Làm thế nào để mua sắm online an toàn?',
  'Cách bảo vệ tài khoản khỏi lừa đảo online',
];

// Danh sách lý do báo cáo
const reportReasons = [
  { id: 'inappropriate', label: 'Nội dung không phù hợp', icon: '⚠️' },
  { id: 'offensive', label: 'Nội dung xúc phạm', icon: '😡' },
  { id: 'misinformation', label: 'Thông tin sai lệch', icon: '❌' },
  { id: 'spam', label: 'Tin rác/Spam', icon: '🚫' },
  { id: 'harmful', label: 'Nội dung có hại', icon: '☢️' },
  { id: 'other', label: 'Lý do khác', icon: '📝' },
];

const ChatBot = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  
  // Trạng thái cho tính năng báo cáo
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportingMessage, setReportingMessage] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);


  const scrollViewRef = useRef(null);
  const textInputRef = useRef(null);
  const webViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const typingDotsAnim = useRef(new Animated.Value(0)).current;

  const navigation = useNavigation();
  const { currentFontSize, getScaledSize } = UserPreferences();

  useEffect(() => {
    initializeChat();
    setupAnimations();
    setupKeyboardListeners();
    const unsub = auth().onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  const initializeChat = () => {
    const welcome = {
      id: Date.now(),
      text: 'Xin chào! Tôi là trợ lý EasyTech, chuyên giúp đỡ các bác, cô, chú giải đáp thắc mắc về công nghệ. Bác có thể hỏi tôi về cách sử dụng điện thoại, máy tính, internet hay bất kỳ thiết bị điện tử nào. Tôi sẽ giải thích thật đơn giản và chi tiết ạ!\n\n💡 Lưu ý: Nếu bạn thấy có câu trả lời nào không phù hợp, hãy nhấn vào nút "Báo cáo" để giúp chúng tôi cải thiện dịch vụ.',
      isUser: false,
      timestamp: new Date(),
      type: 'welcome',
    };
    setMessages([welcome]);
  };

  const setupAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingDotsAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(typingDotsAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const setupKeyboardListeners = () => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      setTimeout(scrollToBottom, 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const callGeminiAPI = async (userMessage) => {
    const context = ''; // TODO: load actual context from your DB/vector DB
    const prompt = promptTemplateString
      .replace('{context}', context)
      .replace('{question}', userMessage);

    try {
      const data = await generateAI(prompt);
      return data.candidates[0].content.parts[0].text.trim();
    } catch (err) {
      console.error('Error calling Gemini:', err.response?.data || err.message);
      return 'Xin lỗi, đã có lỗi xảy ra. Bác thử hỏi lại nhé!';
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;
    const text = message.trim();
    setMessage('');
    setIsSending(true);
    setSuggestionVisible(false);

    const userMsg = { id: Date.now(), text, isUser: true, timestamp: new Date() };
    setMessages((m) => [...m, userMsg]);
    setIsTyping(true);

    if (user) {
      firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          assistantQuestions: firestore.FieldValue.increment(1),
          lastChatDate: firestore.FieldValue.serverTimestamp(),
        })
        .catch(console.error);
    }

    setTimeout(async () => {
      const reply = await callGeminiAPI(text);
      const botMsg = { 
        id: Date.now() + 1, 
        text: reply, 
        isUser: false, 
        timestamp: new Date(),
        isAIGenerated: true // Đánh dấu tin nhắn được tạo bởi AI
      };
      setIsTyping(false);
      setMessages((m) => [...m, botMsg]);
      setIsSending(false);
    }, 1500 + Math.random() * 1000);
  };

  // Hàm helper để reset tất cả state báo cáo
  const resetReportState = () => {
    setSelectedReportReason('');
    setReportDetails('');
    setReportingMessage(null);
    setIsSubmittingReport(false);
  };

  // Hàm xử lý báo cáo nội dung
  const handleReportContent = (message) => {
    setReportingMessage(message);
    setIsReportModalVisible(true);
    setSelectedReportReason('');
    setReportDetails('');
  };

  // Hàm đóng modal báo cáo
  const closeReportModal = () => {
    setIsReportModalVisible(false);
    resetReportState();
  };

  const submitReport = async () => {
    if (!selectedReportReason || !reportingMessage) {
      Alert.alert('Thông báo', 'Vui lòng chọn lý do báo cáo');
      return;
    }

    setIsSubmittingReport(true);

    try {
      const reportData = {
        messageId: reportingMessage.id,
        messageText: reportingMessage.text,
        reportReason: selectedReportReason,
        reportDetails: reportDetails.trim(),
        reportedBy: user?.uid || 'anonymous',
        reportedAt: firestore.FieldValue.serverTimestamp(),
        status: 'pending', // pending, reviewed, resolved
        userEmail: user?.email || null,
      };

      // Lưu báo cáo vào Firestore
      await firestore()
        .collection('contentReports')
        .add(reportData);

      // Cập nhật thống kê báo cáo cho tin nhắn
      await firestore()
        .collection('messageReports')
        .doc(reportingMessage.id.toString())
        .set({
          messageId: reportingMessage.id,
          messageText: reportingMessage.text,
          reportCount: firestore.FieldValue.increment(1),
          lastReportedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

      // Đóng modal và reset state
      setIsReportModalVisible(false);
      resetReportState();

      // Hiển thị thông báo thành công sau khi đóng modal
      setTimeout(() => {
        Alert.alert(
          'Cảm ơn bạn!', 
          'Báo cáo của bạn đã được gửi thành công. Chúng tôi sẽ xem xét và cải thiện chất lượng dịch vụ.'
        );
      }, 200);

    } catch (error) {
      console.error('Error submitting report:', error);
      setIsSubmittingReport(false);
      Alert.alert('Lỗi', 'Không thể gửi báo cáo. Vui lòng thử lại sau.');
    }
  };

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const TypingIndicator = () => (
    <Animated.View style={[styles.messageBubble, styles.botMessage, styles.typingBubble]}>
      <View style={styles.typingContainer}>
        <Animated.View style={[styles.typingDots, { opacity: typingDotsAnim }]}>
          <View style={[styles.typingDot, styles.dot1]} />
          <View style={[styles.typingDot, styles.dot2]} />
          <View style={[styles.typingDot, styles.dot3]} />
        </Animated.View>
        <Text style={[styles.typingText, { fontSize: getScaledSize(14) }]}>
          Đang suy nghĩ...
        </Text>
      </View>
    </Animated.View>
  );

  const MessageBubble = ({ msg, index }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.messageBubble,
          msg.isUser ? styles.userMessage : styles.botMessage,
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onLongPress={() =>
            Share.share({ message: msg.isUser ? msg.text : `Trợ lý: ${msg.text}` })
          }
          activeOpacity={0.8}
        >
          <Text
            style={{
              fontSize: currentFontSize,
              color: msg.isUser ? '#fff' : '#333',
              lineHeight: currentFontSize * 1.5,
            }}
          >
            {msg.text}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text
              style={{
                fontSize: getScaledSize(12),
                opacity: 0.6,
                color: msg.isUser ? '#ffffff90' : '#66666690',
              }}
            >
              {formatTime(msg.timestamp)}
            </Text>
            
            {/* Nút báo cáo chỉ hiển thị cho tin nhắn từ AI */}
            {msg.isAIGenerated && !msg.isUser && (
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => handleReportContent(msg)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="flag-outline" size={getScaledSize(14)} color="#ff6b6b" />
                <Text style={styles.reportButtonText}>Báo cáo</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const SuggestionChips = () =>
    suggestionVisible && (
      <Animated.View style={[styles.suggestionsContainer, { opacity: fadeAnim }]}>
        <Text style={{ fontSize: getScaledSize(16), fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
          💡 Câu hỏi thường gặp:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {commonQuestions.map((q, i) => (
            <TouchableOpacity
              key={i}
              style={styles.suggestionChip}
              onPress={() => {
                setMessage(q);
                textInputRef.current?.focus();
              }}
            >
              <Text style={{ fontSize: getScaledSize(13), color: '#1976d2', textAlign: 'center' }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    );

  const handleVoiceInput = () => setIsVoiceModalVisible(true);

  const onWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'speechResult') {
        setMessage(data.text);
        setIsVoiceModalVisible(false);
        textInputRef.current?.focus();
      } else {
        Alert.alert('Lỗi nhận diện giọng nói', data.message || 'Vui lòng thử lại.');
        setIsVoiceModalVisible(false);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const speechRecognitionHtml = `
    <!DOCTYPE html>
    <html><body>
      <script>
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type:'error', message:'Không hỗ trợ nhận diện giọng nói.' }));
        } else {
          const rec = new SpeechRecognition();
          rec.lang='vi-VN'; rec.interimResults=false; rec.maxAlternatives=1;
          rec.onresult = e => window.ReactNativeWebView.postMessage(JSON.stringify({ type:'speechResult', text:e.results[0][0].transcript }));
          rec.onerror = e => window.ReactNativeWebView.postMessage(JSON.stringify({ type:'error', message:e.error }));
          rec.start();
        }
      </script>
    </body></html>
  `;

  // Modal báo cáo nội dung
  const ReportModal = () => (
    <Modal
      visible={isReportModalVisible}
      transparent
      animationType="slide"
      onRequestClose={closeReportModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.reportModalContent}>
          <View style={styles.reportModalHeader}>
            <Text style={styles.reportModalTitle}>Báo cáo nội dung không phù hợp</Text>
            <TouchableOpacity
              onPress={closeReportModal}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.reportModalBody}>
            <Text style={styles.reportSectionTitle}>Tin nhắn được báo cáo:</Text>
            <View style={styles.reportedMessageContainer}>
              <Text style={styles.reportedMessageText}>
                {reportingMessage?.text}
              </Text>
            </View>

            <Text style={styles.reportSectionTitle}>Chọn lý do báo cáo:</Text>
            {reportReasons.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reportReasonItem,
                  selectedReportReason === reason.id && styles.selectedReportReason
                ]}
                onPress={() => setSelectedReportReason(reason.id)}
              >
                <Text style={styles.reportReasonIcon}>{reason.icon}</Text>
                <Text style={styles.reportReasonLabel}>{reason.label}</Text>
                {selectedReportReason === reason.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#00cc66" />
                )}
              </TouchableOpacity>
            ))}

            <Text style={styles.reportSectionTitle}>Chi tiết bổ sung (tuỳ chọn):</Text>
            <TextInput
              style={styles.reportDetailsInput}
              placeholder="Mô tả thêm về vấn đề bạn gặp phải..."
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{reportDetails.length}/500</Text>
          </ScrollView>

          <View style={styles.reportModalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeReportModal}
            >
              <Text style={styles.cancelButtonText}>Huỷ</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                !selectedReportReason && styles.disabledSubmitButton
              ]}
              onPress={submitReport}
              disabled={!selectedReportReason || isSubmittingReport}
            >
              {isSubmittingReport ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Gửi báo cáo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#007a4d" barStyle="light-content" />
      <Header showBackButton={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          <Animated.View
            style={[
              styles.assistantBanner,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.robotIconContainer}>
              <Text style={styles.robotIconText}>👴</Text>
              <View style={styles.onlineIndicator} />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={{ fontSize: getScaledSize(18), fontWeight: 'bold', color: '#fff' }}>
                Trợ lý Công nghệ EasyTech
              </Text>
              <Text style={{ fontSize: getScaledSize(14), color: '#fff', opacity: 0.9 }}>
                Hỗ trợ công nghệ cho người cao tuổi
              </Text>
            </View>
          </Animated.View>

          <SuggestionChips />
          {messages.map((msg, idx) => (
            <MessageBubble key={msg.id} msg={msg} index={idx} />
          ))}
          {isTyping && <TypingIndicator />}
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <View style={styles.textInputContainer}>
              <TextInput
                ref={textInputRef}
                style={{
                  fontSize: currentFontSize,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 24,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  backgroundColor: '#f9fafb',
                  maxHeight: 120,
                  paddingRight: 50,
                  color: '#1f2937',
                }}
                placeholder="Hỏi tôi về công nghệ..."
                placeholderTextColor="#999"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                onFocus={() => {
                  setSuggestionVisible(false);
                  setTimeout(scrollToBottom, 300);
                }}
              />
              <TouchableOpacity style={styles.micButton} onPress={handleVoiceInput}>
                <Ionicons name="mic-outline" size={getScaledSize(22)} color="#00cc66" />
              </TouchableOpacity>
            </View>
            {message.length > 0 && (
              <Text
                style={{
                  fontSize: getScaledSize(12),
                  color: '#9ca3af',
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                {message.length}/500
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || isSending) && styles.disabledButton,
            ]}
            onPress={handleSendMessage}
            disabled={!message.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={getScaledSize(20)} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modal nhận diện giọng nói */}
      <Modal
        visible={isVoiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVoiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đang lắng nghe...</Text>
            <ActivityIndicator size="large" color="#00cc66" />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsVoiceModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Hủy</Text>
            </TouchableOpacity>
            <WebView
              ref={webViewRef}
              source={{ html: speechRecognitionHtml }}
              style={styles.webView}
              onMessage={onWebViewMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
            />
          </View>
        </View>
      </Modal>

      {/* Modal báo cáo nội dung */}
      <ReportModal />

      {!keyboardVisible && <TabBar onTabPress={(t) => navigation.navigate(t)} selectedTab="ChatBot" />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardAvoid: { flex: 1 },
  scrollViewContent: { paddingBottom: 20 },
  assistantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    elevation: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  robotIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  robotIconText: { fontSize: 32 },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  bannerTextContainer: { flex: 1 },
  suggestionsContainer: { marginHorizontal: 20, marginBottom: 10 },
  suggestionChip: {
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#bbdefb',
    minWidth: 120,
  },
  messageBubble: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    maxWidth: SCREEN_WIDTH * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  botMessage: { backgroundColor: '#fff', alignSelf: 'flex-start', borderColor: '#e5e7eb', borderWidth: 1 },
  userMessage: { backgroundColor: '#00cc66', alignSelf: 'flex-end' },
  typingBubble: { backgroundColor: '#f3f4f6' },
  typingContainer: { flexDirection: 'row', alignItems: 'center' },
  typingDots: { flexDirection: 'row', marginRight: 8 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9ca3af', marginRight: 4 },
  dot1: {}, dot2: {}, dot3: {},
  typingText: { fontStyle: 'italic' },
  
  // Styles cho footer của tin nhắn
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  reportButtonText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginLeft: 4,
    fontWeight: '500',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 90,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputWrapper: { flex: 1, marginRight: 12 },
  textInputContainer: { position: 'relative' },
  micButton: { position: 'absolute', right: 10, top: '50%', transform: [{ translateY: -11 }], padding: 4 },
  sendButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#00cc66', justifyContent: 'center', alignItems: 'center',
  },
  disabledButton: { backgroundColor: '#d1d5db' },

  // Styles cho modal báo cáo
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  reportModalContent: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reportModalTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  reportModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reportSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 16,
  },
  reportedMessageContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  reportedMessageText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  reportReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  selectedReportReason: {
    borderColor: '#00cc66',
    backgroundColor: '#f0fff4',
  },
  reportReasonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  reportReasonLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  reportDetailsInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    height: 80,
    backgroundColor: '#f9fafb',
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  reportModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#ff6b6b',
    marginLeft: 8,
    alignItems: 'center',
  },
  disabledSubmitButton: {
    backgroundColor: '#d1d5db',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 20, 
    width: '80%', 
    alignItems: 'center' 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 16 
  },
  modalCloseButton: { 
    backgroundColor: '#f8f9fa', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 12, 
    marginTop: 16 
  },
  modalCloseButtonText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#333' 
  },
  webView: { 
    width: 0, 
    height: 0, 
    opacity: 0 
  },
});

export default ChatBot;
