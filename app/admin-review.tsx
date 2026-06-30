import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  AdminService,
  ManualReviewQueueItem,
  MarketplaceReportQueueItem,
  MarketplaceReportStatus,
} from '../src/services/AdminService';

type AdminQueueTab = 'manual' | 'marketplace';

const MARKETPLACE_REPORT_ACTIONS: Array<{
  status: MarketplaceReportStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { status: 'REVIEWED', label: 'Reviewed', icon: 'checkmark-circle-outline' },
  { status: 'ACTIONED', label: 'Actioned', icon: 'hammer-outline' },
  { status: 'DISMISSED', label: 'Dismiss', icon: 'close-circle-outline' },
];

export default function AdminReviewScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { isAdmin } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<AdminQueueTab>('manual');
  const [requests, setRequests] = useState<ManualReviewQueueItem[]>([]);
  const [marketplaceReports, setMarketplaceReports] = useState<MarketplaceReportQueueItem[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    void loadQueue();
  }, [isAdmin]);

  const loadQueue = async () => {
    try {
      setIsLoading(true);
      const [queue, reports] = await Promise.all([
        AdminService.getManualReviewQueue(),
        AdminService.getMarketplaceReportQueue(),
      ]);

      setRequests(queue);
      setMarketplaceReports(reports);

      const previews = await Promise.all(
        queue
          .filter((item) => item.badgeImagePath)
          .map(async (item) => ({
            id: item.id,
            url: await AdminService.createBadgePreviewUrl(item.badgeImagePath as string),
          }))
      );

      setPreviewUrls(
        previews.reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = item.url;
          return acc;
        }, {})
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load manual review queue.';
      Alert.alert('Admin Review Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (item: ManualReviewQueueItem, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await AdminService.reviewManualRequest({
        requestId: item.id,
        profileId: item.profileId,
        decision,
        reviewNotes: noteById[item.id],
      });

      setRequests((current) =>
        current.map((request) =>
          request.id === item.id
            ? {
                ...request,
                status: decision,
                reviewNotes: noteById[item.id],
              }
            : request
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to review this request.';
      Alert.alert('Decision Failed', message);
    }
  };

  const handleMarketplaceStatus = async (item: MarketplaceReportQueueItem, status: MarketplaceReportStatus) => {
    try {
      await AdminService.updateMarketplaceReportStatus(item.id, status);
      setMarketplaceReports((current) =>
        current.map((report) =>
          report.id === item.id
            ? {
                ...report,
                status,
                updatedAt: new Date().toISOString(),
              }
            : report
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update this report.';
      Alert.alert('Report Update Failed', message);
    }
  };

  const openMarketplaceListing = (listingId: string) => {
    router.push({ pathname: '/listing/[id]', params: { id: listingId } });
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <Ionicons name="lock-closed-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.centerTitle}>Admin Access Only</Text>
          <Text style={styles.centerText}>This queue is only available to approved YoFly Crew admins.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Review</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => void loadQueue()}>
          <Ionicons name="refresh" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'manual' && styles.tabButtonActive]}
          onPress={() => setActiveTab('manual')}
        >
          <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
            Manual ({requests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'marketplace' && styles.tabButtonActive]}
          onPress={() => setActiveTab('marketplace')}
        >
          <Text style={[styles.tabText, activeTab === 'marketplace' && styles.tabTextActive]}>
            Reports ({marketplaceReports.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'manual' ? (
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={() => void loadQueue()}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Ionicons name="checkmark-done-outline" size={40} color={theme.colors.success} />
            <Text style={styles.centerTitle}>Queue Clear</Text>
            <Text style={styles.centerText}>No manual review requests are waiting right now.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{item.fullName || 'Crew Member'}</Text>
                <Text style={styles.cardMeta}>{item.claimedAirline || 'Unknown airline'}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            {!!item.workEmail && <Text style={styles.bodyText}>Work email: {item.workEmail}</Text>}
            {!!item.employeeIdLast4 && (
              <Text style={styles.bodyText}>Employee ID last 4: {item.employeeIdLast4}</Text>
            )}

            {previewUrls[item.id] ? (
              <Image source={{ uri: previewUrls[item.id] }} style={styles.previewImage} />
            ) : item.badgeImagePath ? (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderText}>Private badge image attached</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.noteInput}
              value={noteById[item.id] || ''}
              onChangeText={(value) => setNoteById((current) => ({ ...current, [item.id]: value }))}
              placeholder="Review notes"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => void handleDecision(item, 'REJECTED')}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => void handleDecision(item, 'APPROVED')}
              >
                <Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      ) : (
        <FlatList
          data={marketplaceReports}
          keyExtractor={(item) => item.id}
          refreshing={isLoading}
          onRefresh={() => void loadQueue()}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="shield-checkmark-outline" size={40} color={theme.colors.success} />
              <Text style={styles.centerTitle}>No Reports</Text>
              <Text style={styles.centerText}>Marketplace listing reports will appear here for admin review.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardTitle}>{item.listingTitle || 'Removed listing'}</Text>
                  <Text style={styles.cardMeta}>
                    {item.listingAirport || 'Unknown airport'} · {item.reason}
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.reportSummary}>
                <View style={styles.reportSummaryItem}>
                  <Text style={styles.reportLabel}>Reporter</Text>
                  <Text style={styles.reportValue}>
                    {item.reporterName || item.reporterEmail || 'Verified crew'}
                  </Text>
                </View>
                <View style={styles.reportSummaryItem}>
                  <Text style={styles.reportLabel}>Seller</Text>
                  <Text style={styles.reportValue}>{item.listingHostName || 'Listing owner'}</Text>
                </View>
              </View>

              {item.notes ? (
                <View style={styles.reportNote}>
                  <Text style={styles.reportLabel}>Notes</Text>
                  <Text style={styles.bodyText}>{item.notes}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.openListingButton}
                onPress={() => openMarketplaceListing(item.listingId)}
              >
                <Ionicons name="open-outline" size={16} color={theme.colors.background} />
                <Text style={styles.openListingText}>Open Listing</Text>
              </TouchableOpacity>

              <View style={styles.reportActionGrid}>
                {MARKETPLACE_REPORT_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.status}
                    style={[
                      styles.reportActionButton,
                      item.status === action.status && styles.reportActionButtonActive,
                    ]}
                    disabled={item.status === action.status}
                    onPress={() => void handleMarketplaceStatus(item, action.status)}
                  >
                    <Ionicons
                      name={action.icon}
                      size={15}
                      color={item.status === action.status ? theme.colors.background : theme.colors.text}
                    />
                    <Text
                      style={[
                        styles.reportActionText,
                        item.status === action.status && styles.reportActionTextActive,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: '800',
    },
    tabRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    tabButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tabText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    tabTextActive: {
      color: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: 40,
      gap: theme.spacing.md,
      flexGrow: 1,
    },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    centerTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    centerText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    cardHeaderCopy: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    cardMeta: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    statusPill: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '900',
    },
    bodyText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    reportSummary: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    reportSummaryItem: {
      flex: 1,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      padding: theme.spacing.sm,
      gap: 4,
    },
    reportLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    reportValue: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
    reportNote: {
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.sm,
      gap: 4,
    },
    openListingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 44,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 14,
    },
    openListingText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '900',
    },
    reportActionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    reportActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 40,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: 12,
    },
    reportActionButtonActive: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    reportActionText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    reportActionTextActive: {
      color: theme.colors.background,
    },
    previewImage: {
      width: '100%',
      height: 200,
      borderRadius: theme.roundness.md,
    },
    imagePlaceholder: {
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      padding: theme.spacing.md,
    },
    placeholderText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    noteInput: {
      minHeight: 84,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      textAlignVertical: 'top',
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    rejectButton: {
      flex: 1,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: theme.colors.error + '18',
      paddingVertical: 14,
      alignItems: 'center',
    },
    rejectText: {
      color: theme.colors.error,
      fontSize: 15,
      fontWeight: '900',
    },
    approveButton: {
      flex: 1,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.success,
      paddingVertical: 14,
      alignItems: 'center',
    },
    approveText: {
      color: theme.colors.background,
      fontSize: 15,
      fontWeight: '900',
    },
  });
