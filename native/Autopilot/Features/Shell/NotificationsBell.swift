import SwiftUI
import Supabase

/// Un aviso de la cuenta (tabla `notifications`): lo crean la renovación del plan, el ajuste de
/// macros, los recordatorios y los pagos. El mismo que lista la campana de la web.
struct AppNotice: Decodable, Identifiable, Equatable {
    let id: UUID
    let type: String?
    let title: String
    let message: String?
    var read: Bool
    let created_at: String
}

enum NoticesRepo {
    /// Los 20 últimos, como `NotificationsBell.tsx`.
    static func latest(userId: UUID) async throws -> [AppNotice] {
        try await Backend.client.from("notifications").select("id, type, title, message, read, created_at")
            .eq("user_id", value: userId).order("created_at", ascending: false).limit(20).execute().value
    }

    static func markRead(_ ids: [UUID]) async {
        guard !ids.isEmpty else { return }
        struct Update: Encodable { let read: Bool }
        _ = try? await Backend.client.from("notifications").update(Update(read: true))
            .in("id", values: ids.map { $0.uuidString.lowercased() }).execute()
    }

    /// «5m», «3h», «2d»: `timeAgo` de la web.
    static func ago(_ iso: String, now: Date = Date()) -> String {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "" }
        let mins = max(0, Int(now.timeIntervalSince(date) / 60))
        if mins < 60 { return "\(mins)m" }
        let hours = mins / 60
        return hours < 24 ? "\(hours)h" : "\(hours / 24)d"
    }

    /// Icono gris por tipo, como `typeIcon` de la web.
    static func icon(_ type: String?) -> String {
        switch type {
        case "plan_renewed": "lu-calendar-sync"
        case "macros_adjusted": "lu-target"
        case "reminder": "lu-dumbbell"
        default: "lu-inbox"
        }
    }
}

/// Campana de la cabecera (iPhone) y de la barra de la ventana (Mac), como `NotificationsBell`
/// de la web: contador dorado de no leídos y, al abrirla, la lista; abrirla los marca como leídos.
struct NotificationsBell: View {
    @EnvironmentObject private var session: SessionModel
    @State private var notices: [AppNotice] = []
    @State private var open = false

    private var unread: Int { notices.filter { !$0.read }.count }

    var body: some View {
        Button {
            Haptics.tap()
            open = true
            let ids = notices.filter { !$0.read }.map(\.id)
            if !ids.isEmpty {
                for index in notices.indices { notices[index].read = true }
                Task { await NoticesRepo.markRead(ids) }
            }
        } label: {
            Image("lu-bell").renderingMode(.template).resizable().frame(width: 17, height: 17)
                .frame(width: 30, height: 30)
                .frame(width: 44, height: 44)
                .overlay(alignment: .topTrailing) {
                    if unread > 0 {
                        Text(unread > 9 ? "9+" : "\(unread)")
                            .font(.inter(size: 11, weight: .bold)).monospacedDigit()
                            .foregroundStyle(Palette.background)
                            .padding(.horizontal, 4)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(Palette.gold, in: Capsule())
                            .padding(2)
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Palette.foreground)
        .accessibilityLabel(unread > 0 ? "Notificaciones, \(unread) sin leer" : "Notificaciones")
        .task(id: session.userIdString) { await load() }
        .sheet(isPresented: $open) {
            NoticesSheet(notices: notices)
                .presentationDetents([.medium, .large])
                .presentationBackground(Palette.background)
                #if os(macOS)
                .frame(minWidth: 460, minHeight: 420)
                #endif
        }
    }

    private func load() async {
        guard let userId = session.userId, let rows = try? await NoticesRepo.latest(userId: userId) else { return }
        notices = rows
    }
}

/// La hoja «Notificaciones»: una tarjeta con una fila por aviso (icono gris, título, texto y hace cuánto).
private struct NoticesSheet: View {
    let notices: [AppNotice]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("Notificaciones").font(.apTitle3).accessibilityAddTraits(.isHeader)
                    Spacer()
                    #if os(macOS)
                    Button("Cerrar") { dismiss() }.buttonStyle(.plain).foregroundStyle(Palette.gold)
                    #endif
                }
                if notices.isEmpty {
                    VStack(spacing: 10) {
                        Image("lu-bell-off").renderingMode(.template).resizable().frame(width: 32, height: 32)
                            .foregroundStyle(Palette.muted).accessibilityHidden(true)
                        Text("Sin notificaciones").font(.apHeadline)
                        Text("Aquí verás los cambios en tu plan y los recordatorios.")
                            .font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 64)
                    .accessibilityElement(children: .combine)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(notices.enumerated()), id: \.element.id) { index, notice in
                            if index > 0 { Divider().overlay(Palette.separator).padding(.leading, 52) }
                            HStack(alignment: .top, spacing: 14) {
                                Image(NoticesRepo.icon(notice.type)).renderingMode(.template).resizable()
                                    .frame(width: 20, height: 20).foregroundStyle(Palette.muted)
                                    .frame(width: 24).padding(.top, 2).accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(notice.title).font(.apBody)
                                    if let message = notice.message, !message.isEmpty {
                                        Text(message).font(.apSubhead).foregroundStyle(Palette.muted)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                Text(NoticesRepo.ago(notice.created_at)).font(.apSubhead).monospacedDigit()
                                    .foregroundStyle(Palette.muted)
                            }
                            .padding(.horizontal, 16).padding(.vertical, 12)
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .surface()
                }
            }
            .padding(20)
        }
        .screenBackground()
    }
}
