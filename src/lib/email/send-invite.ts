import nodemailer from "nodemailer";

interface InviteEmailData {
  email: string;
  storeName: string;
  roleHint: string;
  inviteUrl: string;
  invitedBy: string;
}

export async function sendInviteEmail(data: InviteEmailData) {
  const { email, storeName, roleHint, inviteUrl, invitedBy } = data;

  // 이메일 전송기 설정 (개발 환경에서는 콘솔 출력)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // 이메일 템플릿
  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">매장 초대</h2>
      <p>안녕하세요!</p>
      <p><strong>${invitedBy}</strong>님이 <strong>${storeName}</strong>에서 근무하실 것을 초대했습니다.</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">초대 세부사항</h3>
        <p><strong>매장:</strong> ${storeName}</p>
        <p><strong>역할:</strong> ${
          roleHint === "PART_TIMER" ? "파트타이머" : roleHint
        }</p>
        <p><strong>초대자:</strong> ${invitedBy}</p>
      </div>
      
      <p>아래 링크를 클릭하여 초대를 수락하고 계정을 설정해주세요:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          초대 수락하기
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        이 링크는 7일 후에 만료됩니다. 문제가 있으시면 관리자에게 문의해주세요.
      </p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        이 이메일은 자동으로 발송되었습니다. 답장하지 마세요.
      </p>
    </div>
  `;

  try {
    // 실제 이메일 전송 (환경변수가 설정된 경우)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const info = await transporter.sendMail({
        from: `"Workeasy" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `[${storeName}] 매장 초대`,
        html: emailContent,
      });

      console.log("초대 이메일 전송 성공:", {
        messageId: info.messageId,
        email,
        storeName,
      });

      return { success: true, messageId: info.messageId };
    } else {
      // 개발 환경: 콘솔에 이메일 내용 출력
      console.log("=== 초대 이메일 (개발 모드) ===");
      console.log("받는 사람:", email);
      console.log("제목:", `[${storeName}] 매장 초대`);
      console.log("초대 링크:", inviteUrl);
      console.log("이메일 내용:", emailContent);
      console.log("================================");

      return { success: true, messageId: "dev-mode" };
    }
  } catch (error) {
    console.error("이메일 전송 실패:", error);
    throw error;
  }
}
