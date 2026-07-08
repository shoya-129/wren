import BottomSheet, {
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  AlertTriangleIcon as AlertTriangle,
  ArrowLeftIcon as ArrowLeft,
  FlagIcon as Flag,
  SendIcon as Send,
  ShieldAlertIcon as ShieldAlert,
  Trash2Icon as Trash2,
  XIcon as X,
} from "../lib/icons";
import api from "../utils/api";
import { showToast } from "../utils/toast";

const REPORT_REASONS = [
  { key: "spam", label: "Spam" },
  { key: "harassment", label: "Harassment" },
  { key: "impersonation", label: "Impersonation" },
  { key: "misinformation", label: "Misinformation" },
  { key: "other", label: "Other" },
];

const PostOptionsSheet = ({
  visible,
  post,
  canDelete = false,
  onClose,
  onDeleted,
}) => {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["88%"], []);
  const [step, setStep] = useState("menu");
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (sheetRef.current) {
      if (visible) sheetRef.current.snapToIndex(0);
      else sheetRef.current.close();
    }
  }, [visible]);

  const resetState = () => {
    setStep("menu");
    setReason("spam");
    setDetails("");
    setSubmitting(false);
    setDeleting(false);
  };

  const handleClose = () => {
    resetState();
    onClose?.();
    sheetRef.current?.close();
  };

  const submitReport = async () => {
    if (!post?.postId || submitting) return;

    setSubmitting(true);
    try {
      await api.post(`/posts/${post.postId}/report`, {
        reason,
        details: details.trim() || undefined,
      });
      showToast("Thanks. Your report was submitted.");
      handleClose();
    } catch (e) {
      console.error("Failed to report post", e);
      showToast("Could not send the report right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!post?.postId || deleting) return;

    setDeleting(true);
    try {
      await api.delete(`/posts/${post.postId}`);
      onDeleted?.(post.postId);
      handleClose();
    } catch (e) {
      console.error("Failed to delete post", e);
      showToast("Could not delete this post.");
    } finally {
      setDeleting(false);
    }
  };

  const renderHeader = (title, subtitle) => (
    <View className="flex-row items-start justify-between mb-6">
      <View className="flex-1 pr-4">
        <Text
          style={{ fontFamily: "WrenSemiBold" }}
          className="text-white text-lg"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-white/45 text-sm mt-1 leading-5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={handleClose}
        className="w-9 h-9 rounded-full bg-white/10 border border-white/15 items-center justify-center"
      >
        <X size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: "#121212" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
      onClose={handleClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView className="flex-1 px-6 pt-2 pb-6">
        {step === "menu" ? (
          <>
            {renderHeader(
              "Post options",
              canDelete
                ? "Manage this post or take moderation action."
                : "Take moderation action if something feels wrong.",
            )}

            <View className="gap-3">
              {!canDelete ? (
                <Pressable
                  onPress={() => setStep("report")}
                  className="rounded-2xl bg-white/5 border border-white/10 p-4 flex-row items-center gap-3"
                >
                  <View className="w-11 h-11 rounded-full bg-red-500/10 items-center justify-center">
                    <Flag size={18} color="#EF4444" strokeWidth={2.2} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base font-semibold">
                      Report post
                    </Text>
                    <Text className="text-white/45 text-sm mt-1">
                      Share the reason with moderation without decrypting
                      content.
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {canDelete ? (
                <Pressable
                  onPress={() => setStep("delete")}
                  className="rounded-2xl bg-red-500/8 border border-red-500/20 p-4 flex-row items-center gap-3"
                >
                  <View className="w-11 h-11 rounded-full bg-red-500/12 items-center justify-center">
                    <Trash2 size={18} color="#EF4444" strokeWidth={2.2} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base font-semibold">
                      Delete post
                    </Text>
                    <Text className="text-white/45 text-sm mt-1">
                      Remove this post from wren feed.
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {step === "report" ? (
          <>
            <View className="flex-row items-center justify-between mb-6">
              <Pressable
                onPress={() => setStep("menu")}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/15 items-center justify-center"
              >
                <ArrowLeft size={16} color="#FFFFFF" />
              </Pressable>
              <Text
                style={{ fontFamily: "WrenSemiBold" }}
                className="text-white text-lg"
              >
                Report post
              </Text>
              <View className="w-9 h-9" />
            </View>

            <View className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4 flex-row gap-3">
              <ShieldAlert size={18} color="#F59E0B" strokeWidth={2.2} />
              <Text className="flex-1 text-white/50 text-sm leading-5">
                Reports only send moderation metadata. Post content
                stays encrypted.
              </Text>
            </View>

            <Text className="text-white text-sm font-semibold mb-3">
              Reason
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {REPORT_REASONS.map((item) => {
                const active = item.key === reason;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setReason(item.key)}
                    className={`px-4 py-2 rounded-full border ${active
                        ? "bg-red-500/15 border-red-500/30"
                        : "bg-white/5 border-white/10"
                      }`}
                  >
                    <Text
                      className={
                        active
                          ? "text-red-400 text-sm font-semibold"
                          : "text-white/60 text-sm font-semibold"
                      }
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-white text-sm font-semibold mb-3">
              Details
            </Text>
            <View className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-5">
              <BottomSheetTextInput
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={240}
                placeholder="Add optional details to help moderation understand the issue..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={{
                  color: "#FFFFFF",
                  minHeight: 96,
                  textAlignVertical: "top",
                }}
              />
              <Text className="text-white/25 text-xs text-right mt-2">
                {details.length}/240
              </Text>
            </View>

            <Pressable
              onPress={submitReport}
              disabled={submitting}
              className="h-12 rounded-full bg-red-500 items-center justify-center flex-row gap-2"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Send size={16} color="#FFFFFF" strokeWidth={2.2} />
                  <Text
                    style={{ fontFamily: "WrenSemiBold" }}
                    className="text-white text-sm"
                  >
                    Submit report
                  </Text>
                </>
              )}
            </Pressable>
          </>
        ) : null}

        {step === "delete" ? (
          <>
            <View className="flex-row items-center justify-between mb-6">
              <Pressable
                onPress={() => setStep("menu")}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/15 items-center justify-center"
              >
                <ArrowLeft size={16} color="#FFFFFF" />
              </Pressable>
              <Text
                style={{ fontFamily: "WrenSemiBold" }}
                className="text-white text-lg"
              >
                Delete post
              </Text>
              <View className="w-9 h-9" />
            </View>

            <View className="rounded-2xl bg-red-500/8 border border-red-500/20 p-4 mb-5 flex-row gap-3">
              <AlertTriangle size={18} color="#EF4444" strokeWidth={2.2} />
              <Text className="flex-1 text-white/55 leading-5">
                Deleted posts are hidden
                and cannot be restored here.
              </Text>
            </View>

            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              className="h-12 rounded-full bg-red-500 items-center justify-center flex-row gap-2"
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Trash2 size={16} color="#FFFFFF" strokeWidth={2.2} />
                  <Text
                    style={{ fontFamily: "WrenSemiBold" }}
                    className="text-white text-sm"
                  >
                    Delete permanently
                  </Text>
                </>
              )}
            </Pressable>
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
};

export default PostOptionsSheet;
