import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import TabBar from '../TabBar';
import { UserPreferences } from '../UserPreferences';
import Header from '../Header';
import { generateAI } from '../../services/ai';

const TaskTutorial = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { task } = route.params || {};
  const { currentFontSize, getScaledSize } = UserPreferences();

  const [selectedImage, setSelectedImage] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  const MAX_VERIFICATION_ATTEMPTS = 3;
  const ENABLE_AI_VERIFICATION = true;

  const taskConfigurations = {
    '1': {
      steps: [
        'Mở trình duyệt web hoặc ứng dụng Google',
        'Nhập từ khóa về chủ đề bạn quan tâm vào ô tìm kiếm',
        'Nhấn nút tìm kiếm hoặc phím Enter',
        'Xem qua các kết quả tìm kiếm được hiển thị',
        'Chụp ảnh màn hình kết quả tìm kiếm để hoàn thành nhiệm vụ',
      ],
      geminiPrompt: `
        Phân tích ảnh này và xác định xem có phải là ảnh chụp màn hình kết quả tìm kiếm Google không.
        Tìm kiếm các yếu tố sau:
        1. Logo Google hoặc chữ "Google"
        2. Thanh tìm kiếm
        3. Danh sách kết quả tìm kiếm
        4. Giao diện đặc trưng của Google Search
        
        Trả lời bằng JSON:
        {
          "isValid": true/false,
          "confidence": 0-100,
          "reason": "Giải thích tại sao đây là/không là trang tìm kiếm Google"
        }
      `,
    },
    '2': {
      steps: [
        'Mở ứng dụng gọi video (như Zalo, WhatsApp, hoặc FaceTime)',
        'Chọn một người thân hoặc bạn bè để gọi',
        'Thực hiện cuộc gọi video',
        'Chụp ảnh màn hình cuộc gọi video đang diễn ra',
        'Tải ảnh lên để xác nhận hoàn thành',
      ],
      geminiPrompt: `
        Phân tích ảnh này và xác định xem có phải là ảnh chụp màn hình cuộc gọi video không.
        Tìm kiếm các yếu tố sau:
        1. Giao diện ứng dụng gọi video (như Zalo, WhatsApp, FaceTime)
        2. Video hoặc hình ảnh của người tham gia
        3. Các nút điều khiển cuộc gọi (như tắt tiếng, camera)
        
        Trả lời bằng JSON:
        {
          "isValid": true/false,
          "confidence": 0-100,
          "reason": "Giải thích tại sao đây là/không là ảnh chụp cuộc gọi video"
        }
      `,
    },
    '3': {
      steps: [
        'Mở ứng dụng Facebook trên điện thoại',
        'Nhấn vào ô tạo bài viết',
        'Viết một bài chia sẻ về khoảnh khắc trong ngày của bạn',
        'Đăng bài viết',
        'Chụp ảnh màn hình bài viết đã đăng để xác nhận',
      ],
      geminiPrompt: `
        Phân tích ảnh này và xác định xem có phải là ảnh chụp màn hình bài viết trên Facebook không.
        Tìm kiếm các yếu tố sau:
        1. Giao diện Facebook (logo, thanh điều hướng)
        2. Bài viết với nội dung văn bản hoặc hình ảnh
        3. Tên người dùng hoặc ảnh đại diện
        4. Các nút tương tác (thích, bình luận, chia sẻ)
        
        Trả lời bằng JSON:
        {
          "isValid": true/false,
          "confidence": 0-100,
          "reason": "Giải thích tại sao đây là/không là bài viết Facebook"
        }
      `,
    },
    '4': {
      steps: [
        'Mở ứng dụng Zalo trên điện thoại',
        'Chọn một người bạn trong danh sách liên lạc',
        'Gửi một tin nhắn chào hỏi',
        'Chụp ảnh màn hình tin nhắn vừa gửi',
        'Tải ảnh lên để xác nhận hoàn thành',
      ],
      geminiPrompt: `
        Phân tích ảnh này và xác định xem có phải là ảnh chụp màn hình tin nhắn Zalo không.
        Tìm kiếm các yếu tố sau:
        1. Giao diện Zalo (logo, thanh trò chuyện)
        2. Tin nhắn văn bản đã gửi
        3. Tên người nhận hoặc số điện thoại
        4. Thời gian gửi tin nhắn
        
        Trả lời bằng JSON:
        {
          "isValid": true/false,
          "confidence": 0-100,
          "reason": "Giải thích tại sao đây là/không là tin nhắn Zalo"
        }
      `,
    },
  };

  const taskConfig = taskConfigurations[task?.id] || taskConfigurations['1'];
  const taskSteps = taskConfig.steps;
  const geminiPrompt = taskConfig.geminiPrompt;

  const navigateIfExists = (route) => {
    try {
      navigation.navigate(route);
    } catch (error) {
      console.warn(`Navigation error for route ${route}:`, error);
    }
  };

  const handleTabPress = (tab) => {
    navigateIfExists(tab);
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Quyền sử dụng Camera',
            message: 'Ứng dụng cần quyền sử dụng camera để chụp ảnh',
            buttonNeutral: 'Hỏi sau',
            buttonNegative: 'Hủy',
            buttonPositive: 'Đồng ý',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleImagePicker = () => {
    if (verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      Alert.alert(
        'Đã vượt quá số lần thử',
        'Bạn đã thử quá nhiều lần. Vui lòng thực hiện lại nhiệm vụ theo đúng hướng dẫn.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    setShowImagePicker(true);
    Alert.alert(
      'Chọn ảnh chứng minh',
      'Bạn muốn chụp ảnh mới hay chọn từ thư viện?',
      [
        { text: 'Hủy', style: 'cancel', onPress: () => setShowImagePicker(false) },
        { text: 'Thư viện', onPress: openImageLibrary },
        { text: 'Chụp ảnh', onPress: openCamera },
      ]
    );
  };

  const openImageLibrary = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      setShowImagePicker(false);
      if (response.didCancel) {
        return;
      }
      if (response.errorMessage) {
        Alert.alert('Lỗi', response.errorMessage);
        return;
      }
      if (response.assets && response.assets[0]) {
        setSelectedImage(response.assets[0]);
        verifyAndComplete(response.assets[0]);
      }
    });
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setShowImagePicker(false);
      Alert.alert('Lỗi', 'Không có quyền sử dụng camera');
      return;
    }

    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
    };

    launchCamera(options, (response) => {
      setShowImagePicker(false);
      if (response.didCancel) {
        return;
      }
      if (response.errorMessage) {
        Alert.alert('Lỗi', response.errorMessage);
        return;
      }
      if (response.assets && response.assets[0]) {
        setSelectedImage(response.assets[0]);
        verifyAndComplete(response.assets[0]);
      }
    });
  };

  const convertImageToBase64 = async (imageUri) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error('Không thể xử lý ảnh');
    }
  };

  const verifyImageWithGemini = async (base64Image) => {
    try {
      const data = await generateAI(geminiPrompt, base64Image);
      const analysisText = data.candidates[0].content.parts[0].text;

      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        isValid: false,
        confidence: 20,
        reason: 'Không thể phân tích ảnh đúng cách',
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  };

  const verifyAndComplete = async (imageData) => {
    setIsVerifying(true);
    setVerificationAttempts((prev) => prev + 1);

    try {
      let verification;

      if (ENABLE_AI_VERIFICATION) {
        const base64Image = await convertImageToBase64(imageData.uri);
        verification = await verifyImageWithGemini(base64Image);

        if (verification.isValid && verification.confidence >= 70) {
          completeTask();
          return;
        }
      } else {
        verification = {
          isValid: false,
          confidence: 0,
          reason: 'AI verification is disabled',
        };
      }

      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - verificationAttempts - 1;
      if (remainingAttempts > 0) {
        Alert.alert(
          'Chưa đúng yêu cầu',
          `Ảnh không đáp ứng yêu cầu nhiệm vụ:\n\n${verification.reason}\n\nBạn còn ${remainingAttempts} lần thử. Vui lòng thực hiện lại theo hướng dẫn.`,
          [{ text: 'Thử lại', onPress: () => setSelectedImage(null) }]
        );
      } else {
        Alert.alert(
          'Đã hết lượt thử',
          'Bạn đã thử quá nhiều lần. Vui lòng thực hiện lại nhiệm vụ từ đầu.',
          [{ text: 'Về lại', onPress: () => navigation.goBack() }]
        );
      }

      setSelectedImage(null);
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert(
        'Lỗi xác thực',
        'Không thể xác thực ảnh của bạn. Vui lòng kiểm tra kết nối mạng và thử lại.',
        [{ text: 'Thử lại', onPress: () => setSelectedImage(null) }]
      );
      setSelectedImage(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const completeTask = () => {
    Alert.alert(
      'Hoàn thành nhiệm vụ! 🎉',
      `Chúc mừng! Bạn đã hoàn thành nhiệm vụ "${task?.title}".\n\n+${task?.points || 10} điểm đã được thêm vào tài khoản!`,
      [
        {
          text: 'Tuyệt vời!',
          onPress: () => {
            navigation.navigate('Task', {
              completedTaskId: task?.id,
              earnedPoints: task?.points || 10,
            });
          },
        },
      ]
    );
  };

  const dynamicStyles = StyleSheet.create({
    logoText: {
      fontSize: getScaledSize(16),
      color: '#00cc66',
      fontWeight: 'bold',
    },
    logoTitle: {
      fontSize: getScaledSize(18),
      color: '#fff',
      fontWeight: 'bold',
    },
    taskTitle: {
      fontSize: getScaledSize(18),
      fontWeight: '600',
      color: '#333',
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: getScaledSize(16),
      fontWeight: '600',
      color: '#00cc66',
      marginBottom: 12,
    },
    description: {
      fontSize: currentFontSize,
      color: '#666',
      lineHeight: currentFontSize * 1.4,
      marginBottom: 16,
    },
    infoLabel: {
      fontSize: getScaledSize(14),
      color: '#333',
    },
    infoTitle: {
      fontWeight: '600',
    },
    stepNumber: {
      fontSize: getScaledSize(14),
      fontWeight: '600',
      color: '#333',
      marginRight: 8,
      minWidth: 16,
    },
    stepText: {
      fontSize: getScaledSize(14),
      color: '#666',
      lineHeight: getScaledSize(20),
      flex: 1,
    },
    verifyingText: {
      fontSize: getScaledSize(14),
      marginTop: 8,
      color: '#00cc66',
      fontWeight: '600',
    },
    completeButtonText: {
      fontSize: getScaledSize(16),
      color: '#fff',
      fontWeight: '600',
    },
    attemptsText: {
      fontSize: getScaledSize(12),
      color: '#FF9800',
      marginTop: 8,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#00cc66" barStyle="light-content" />
      
      <Header showBackButton={true} />

      <View style={styles.taskTitleContainer}>
        <Text style={dynamicStyles.taskTitle}>{task?.title || 'Nhiệm vụ'}</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={dynamicStyles.sectionTitle}>Mô tả nhiệm vụ</Text>
          <Text style={dynamicStyles.description}>
            {task?.description || 'Thực hiện nhiệm vụ theo hướng dẫn và tải ảnh xác nhận.'}
          </Text>
          <View style={styles.taskInfo}>
            <Text style={dynamicStyles.infoLabel}>
              <Text style={dynamicStyles.infoTitle}>Điểm thưởng:</Text> {task?.points || 10} điểm
            </Text>
            <Text style={dynamicStyles.infoLabel}>
              <Text style={dynamicStyles.infoTitle}>Thời gian:</Text> {task?.estimatedTime || '5 phút'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={dynamicStyles.sectionTitle}>Hướng dẫn thực hiện</Text>
          {taskSteps.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <Text style={dynamicStyles.stepNumber}>{index + 1}.</Text>
              <Text style={dynamicStyles.stepText}>{step}</Text>
            </View>
          ))}
          <View style={styles.tipContainer}>
            <Ionicons name="bulb-outline" size={getScaledSize(16)} color="#FF9800" />
            <Text style={[dynamicStyles.stepText, { marginLeft: 8, fontStyle: 'italic' }]}>
              <Text style={{ fontWeight: '600' }}>Mẹo:</Text> Hãy chụp ảnh rõ ràng để xác thực dễ dàng
            </Text>
          </View>
        </View>

        {selectedImage && (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Ảnh đã chọn</Text>
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
              {isVerifying && (
                <View style={styles.verifyingOverlay}>
                  <ActivityIndicator size="large" color="#00cc66" />
                  <Text style={dynamicStyles.verifyingText}>Đang xác thực...</Text>
                </View>
              )}
            </View>
            {verificationAttempts > 0 && (
              <Text style={dynamicStyles.attemptsText}>
                Lần thử: {verificationAttempts}/{MAX_VERIFICATION_ATTEMPTS}
              </Text>
            )}
          </View>
        )}

        <View style={styles.completeButtonSection}>
          <TouchableOpacity
            style={[
              styles.completeButton,
              (isVerifying || showImagePicker) && styles.buttonDisabled,
            ]}
            onPress={handleImagePicker}
            disabled={isVerifying || showImagePicker}
          >
            <Ionicons name="camera" size={getScaledSize(20)} color="#fff" />
            <Text style={dynamicStyles.completeButtonText}>
              {isVerifying ? 'Đang xác thực...' : 'Chụp ảnh hoàn thành'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TabBar selectedTab="Task" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  taskTitleContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingBottom: 80,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  taskInfo: {
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00cc66',
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  imagePreviewContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  verifyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  completeButtonSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00cc66',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
});

export default TaskTutorial;