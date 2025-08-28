"use client";

import { Locale, t } from "@/lib/i18n";

interface InviteEmailData {
  inviterName: string;
  storeName: string;
  storeDescription?: string;
  role: "SUB_MANAGER" | "PART_TIMER";
  inviteUrl: string;
  expiresAt: string;
}

/**
 * 역할별 권한 설명 생성
 */
function getRolePermissions(role: string, locale: Locale): string[] {
  if (role === "SUB_MANAGER") {
    switch (locale) {
      case "en":
        return [
          "Create and modify schedules",
          "Approve/reject shift requests",
          "Invite part-timers",
          "Manage store chat",
        ];
      case "ja":
        return [
          "スケジュールの作成・修正",
          "シフト交換リクエストの承認・拒否",
          "アルバイトの招待",
          "店舗チャットの管理",
        ];
      default: // ko
        return [
          "스케줄 생성 및 수정",
          "교대 요청 승인/거절",
          "파트타이머 초대",
          "매장 채팅 관리",
        ];
    }
  } else {
    switch (locale) {
      case "en":
        return [
          "View your schedule",
          "Create shift requests",
          "Participate in team chat",
        ];
      case "ja":
        return [
          "自分のスケジュール確認",
          "シフト交換リクエスト作成",
          "チームチャット参加",
        ];
      default: // ko
        return ["내 스케줄 확인", "교대 요청 생성", "팀 채팅 참여"];
    }
  }
}

/**
 * 역할명 변환
 */
function getRoleName(role: string, locale: Locale): string {
  if (role === "SUB_MANAGER") {
    switch (locale) {
      case "en":
        return "Sub Manager";
      case "ja":
        return "サブ管理者";
      default:
        return "서브 관리자";
    }
  } else {
    switch (locale) {
      case "en":
        return "Part Timer";
      case "ja":
        return "アルバイト";
      default:
        return "파트타이머";
    }
  }
}

/**
 * 초대 이메일 HTML 템플릿 생성
 */
export function generateInviteEmailHTML(
  data: InviteEmailData,
  locale: Locale = "ko"
): string {
  const roleName = getRoleName(data.role, locale);
  const permissions = getRolePermissions(data.role, locale);

  // 다국어 텍스트
  const texts = {
    ko: {
      subject: `${data.storeName}에서 ${roleName}으로 초대합니다`,
      greeting: `안녕하세요!`,
      invitation: `${data.inviterName}님이 귀하를 ${data.storeName}에서 ${roleName}으로 초대했습니다.`,
      storeInfo: "매장 정보",
      roleInfo: "역할 및 권한",
      permissions: "주요 권한:",
      acceptButton: "초대 수락하기",
      expiryNotice: `이 초대는 ${new Date(data.expiresAt).toLocaleDateString(
        "ko-KR",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )}까지 유효합니다.`,
      helpText: "문의 사항이 있으시면 매장으로 연락해주세요.",
      footer: "Workeasy 팀",
      poweredBy: "Powered by Workeasy",
    },
    en: {
      subject: `You're invited to join ${data.storeName} as ${roleName}`,
      greeting: `Hello!`,
      invitation: `${data.inviterName} has invited you to join ${data.storeName} as ${roleName}.`,
      storeInfo: "Store Information",
      roleInfo: "Role & Permissions",
      permissions: "Key permissions:",
      acceptButton: "Accept Invitation",
      expiryNotice: `This invitation is valid until ${new Date(
        data.expiresAt
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}.`,
      helpText: "If you have any questions, please contact the store.",
      footer: "Workeasy Team",
      poweredBy: "Powered by Workeasy",
    },
    ja: {
      subject: `${data.storeName}から${roleName}として招待されました`,
      greeting: `こんにちは！`,
      invitation: `${data.inviterName}さんが、あなたを${data.storeName}の${roleName}として招待しました。`,
      storeInfo: "店舗情報",
      roleInfo: "役割と権限",
      permissions: "主な権限：",
      acceptButton: "招待を承認",
      expiryNotice: `この招待は${new Date(data.expiresAt).toLocaleDateString(
        "ja-JP",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )}まで有効です。`,
      helpText: "ご質問がございましたら、店舗までお問い合わせください。",
      footer: "Workeasy チーム",
      poweredBy: "Powered by Workeasy",
    },
  };

  const text = texts[locale];

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${text.subject}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .email-container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
        }
        .invitation-text {
            font-size: 16px;
            margin-bottom: 25px;
            line-height: 1.6;
        }
        .info-section {
            background-color: #f8fafc;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .info-title {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
        }
        .store-name {
            font-size: 18px;
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 5px;
        }
        .store-description {
            color: #6b7280;
            font-size: 14px;
        }
        .role-badge {
            display: inline-block;
            background-color: #dbeafe;
            color: #1d4ed8;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 15px;
        }
        .permissions-list {
            list-style: none;
            padding: 0;
            margin: 10px 0;
        }
        .permissions-list li {
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
            position: relative;
            padding-left: 20px;
        }
        .permissions-list li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #10b981;
            font-weight: bold;
        }
        .permissions-list li:last-child {
            border-bottom: none;
        }
        .accept-button {
            display: block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 6px;
            text-align: center;
            font-size: 16px;
            font-weight: 600;
            margin: 30px 0;
            transition: background-color 0.2s;
        }
        .accept-button:hover {
            background-color: #1d4ed8;
        }
        .expiry-notice {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
            color: #92400e;
        }
        .help-text {
            font-size: 14px;
            color: #6b7280;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
        }
        .powered-by {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">Workeasy</div>
        </div>
        
        <div class="greeting">${text.greeting}</div>
        
        <div class="invitation-text">
            ${text.invitation}
        </div>
        
        <div class="info-section">
            <div class="info-title">${text.storeInfo}</div>
            <div class="store-name">${data.storeName}</div>
            ${
              data.storeDescription
                ? `<div class="store-description">${data.storeDescription}</div>`
                : ""
            }
        </div>
        
        <div class="info-section">
            <div class="info-title">${text.roleInfo}</div>
            <div class="role-badge">${roleName}</div>
            <div>${text.permissions}</div>
            <ul class="permissions-list">
                ${permissions
                  .map((permission) => `<li>${permission}</li>`)
                  .join("")}
            </ul>
        </div>
        
        <a href="${data.inviteUrl}" class="accept-button">${
    text.acceptButton
  }</a>
        
        <div class="expiry-notice">
            ${text.expiryNotice}
        </div>
        
        <div class="help-text">
            ${text.helpText}
        </div>
        
        <div class="footer">
            <div>${text.footer}</div>
            <div class="powered-by">${text.poweredBy}</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * 초대 이메일 플레인 텍스트 버전 생성
 */
export function generateInviteEmailText(
  data: InviteEmailData,
  locale: Locale = "ko"
): string {
  const roleName = getRoleName(data.role, locale);
  const permissions = getRolePermissions(data.role, locale);

  const texts = {
    ko: {
      subject: `${data.storeName}에서 ${roleName}으로 초대합니다`,
      greeting: `안녕하세요!`,
      invitation: `${data.inviterName}님이 귀하를 ${data.storeName}에서 ${roleName}으로 초대했습니다.`,
      storeInfo: "매장 정보:",
      roleInfo: "역할 및 권한:",
      permissions: "주요 권한:",
      acceptInstruction: "아래 링크를 클릭하여 초대를 수락하세요:",
      expiryNotice: `이 초대는 ${new Date(data.expiresAt).toLocaleDateString(
        "ko-KR"
      )}까지 유효합니다.`,
      helpText: "문의 사항이 있으시면 매장으로 연락해주세요.",
      footer: "Workeasy 팀",
    },
    en: {
      subject: `You're invited to join ${data.storeName} as ${roleName}`,
      greeting: `Hello!`,
      invitation: `${data.inviterName} has invited you to join ${data.storeName} as ${roleName}.`,
      storeInfo: "Store Information:",
      roleInfo: "Role & Permissions:",
      permissions: "Key permissions:",
      acceptInstruction: "Click the link below to accept the invitation:",
      expiryNotice: `This invitation is valid until ${new Date(
        data.expiresAt
      ).toLocaleDateString("en-US")}.`,
      helpText: "If you have any questions, please contact the store.",
      footer: "Workeasy Team",
    },
    ja: {
      subject: `${data.storeName}から${roleName}として招待されました`,
      greeting: `こんにちは！`,
      invitation: `${data.inviterName}さんが、あなたを${data.storeName}の${roleName}として招待しました。`,
      storeInfo: "店舗情報：",
      roleInfo: "役割と権限：",
      permissions: "主な権限：",
      acceptInstruction: "以下のリンクをクリックして招待を承認してください：",
      expiryNotice: `この招待は${new Date(data.expiresAt).toLocaleDateString(
        "ja-JP"
      )}まで有効です。`,
      helpText: "ご質問がございましたら、店舗までお問い合わせください。",
      footer: "Workeasy チーム",
    },
  };

  const text = texts[locale];

  return `
${text.greeting}

${text.invitation}

${text.storeInfo}
- ${data.storeName}${data.storeDescription ? ` (${data.storeDescription})` : ""}

${text.roleInfo}
- ${roleName}

${text.permissions}
${permissions.map((permission) => `- ${permission}`).join("\n")}

${text.acceptInstruction}
${data.inviteUrl}

${text.expiryNotice}

${text.helpText}

---
${text.footer}
`;
}

/**
 * 이메일 제목 생성
 */
export function generateInviteEmailSubject(
  data: InviteEmailData,
  locale: Locale = "ko"
): string {
  const roleName = getRoleName(data.role, locale);

  switch (locale) {
    case "en":
      return `You're invited to join ${data.storeName} as ${roleName}`;
    case "ja":
      return `${data.storeName}から${roleName}として招待されました`;
    default: // ko
      return `${data.storeName}에서 ${roleName}으로 초대합니다`;
  }
}




