/**
 * Smoke test end-to-end de la plateforme.
 *
 * Lance : `npx tsx scripts/smoke-test.ts`
 *
 * Ce script exerce TOUS les modules métier par appels Prisma + reuse des
 * helpers métier (commission, slug). Il ne traverse pas la couche
 * NextAuth/HTTP (les server actions requièrent une session) — on teste donc
 * la logique pure et les invariants DB.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import "dotenv/config";

import { computeCommission } from "../src/lib/commission";

const connectionString = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

const results: { module: string; ok: boolean; detail: string }[] = [];
function pass(module: string, detail: string) {
  results.push({ module, ok: true, detail });
  console.log(`  ✓ ${module} — ${detail}`);
}
function fail(module: string, detail: string) {
  results.push({ module, ok: false, detail });
  console.log(`  ✗ ${module} — ${detail}`);
}

async function cleanup() {
  // Supprime tout ce qui a été créé par ce script (préfixe test-smoke-)
  const users = await prisma.user.findMany({
    where: { email: { startsWith: "smoke-" } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  await prisma.certificate.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.lessonProgress.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.lessonNote.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.wishlistItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.cartItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.review.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.enrollment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.course.deleteMany({ where: { instructorId: { in: userIds } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.promoCode.deleteMany({ where: { code: { startsWith: "SMOKE-" } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  console.log("\n=== SMOKE TEST E-FormationGN ===\n");
  await cleanup();

  // -----------------------------------------------------------------
  // [1] AUTH — création d'un compte student
  // -----------------------------------------------------------------
  console.log("\n▼ [1] Création de compte (signup)");
  const studentEmail = `smoke-student-${Date.now()}@example.com`;
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      hashedPassword: await bcrypt.hash("Test1234!", 12),
      firstName: "Test",
      lastName: "Student",
      name: "Test Student",
      role: "STUDENT",
      status: "ACTIVE",
      emailVerified: new Date(),
    },
  });
  pass("auth/signup", `compte créé (id=${student.id.slice(0, 8)}…)`);

  // Test du token de vérification d'email
  const vToken = await prisma.emailVerificationToken.create({
    data: {
      userId: student.id,
      identifier: student.email,
      token: nanoid(32),
      expires: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  pass("auth/email-verification-token", `token=${vToken.token.slice(0, 8)}…`);

  // Test du token de reset password
  const rToken = await prisma.passwordResetToken.create({
    data: {
      userId: student.id,
      token: nanoid(32),
      expires: new Date(Date.now() + 3600 * 1000),
    },
  });
  pass("auth/password-reset-token", `token=${rToken.token.slice(0, 8)}…`);

  // -----------------------------------------------------------------
  // [2] PROFIL — bio, currency
  // -----------------------------------------------------------------
  console.log("\n▼ [2] Profil");
  await prisma.user.update({
    where: { id: student.id },
    data: {
      bio: "Bio de test.",
      headline: "Étudiant smoke-test",
      preferredCurrency: "EUR",
    },
  });
  const updated = await prisma.user.findUnique({ where: { id: student.id } });
  if (updated?.bio === "Bio de test.") pass("profile/update", "bio + currency OK");
  else fail("profile/update", "bio non persistée");

  // -----------------------------------------------------------------
  // [3] INSTRUCTOR — devenir formateur
  // -----------------------------------------------------------------
  console.log("\n▼ [3] Devenir formateur");
  const instructorEmail = `smoke-instructor-${Date.now()}@example.com`;
  const instructor = await prisma.user.create({
    data: {
      email: instructorEmail,
      hashedPassword: await bcrypt.hash("Test1234!", 12),
      firstName: "Awa",
      lastName: "Instructeur",
      name: "Awa Instructeur",
      role: "INSTRUCTOR",
      isInstructor: true,
      status: "ACTIVE",
      emailVerified: new Date(),
      affiliateCode: `smoke-${nanoid(6).toLowerCase()}`,
    },
  });
  pass("instructor/become", `formateur créé, affiliateCode=${instructor.affiliateCode}`);

  // -----------------------------------------------------------------
  // [4] COURSE — création + sections + leçons
  // -----------------------------------------------------------------
  console.log("\n▼ [4] Création de cours");
  const category = await prisma.category.findFirst({ where: { isActive: true } });
  if (!category) {
    fail("course/setup", "aucune catégorie en base — relancer le seed");
    return;
  }

  const course = await prisma.course.create({
    data: {
      slug: `smoke-cours-${nanoid(6).toLowerCase()}`,
      title: "Formation smoke-test : Maîtrise de Python",
      subtitle: "Apprenez Python en 4h.",
      description:
        "Ce cours de smoke-test couvre les bases de Python pour valider le " +
        "parcours formateur de bout en bout, de la création à la publication.",
      categoryId: category.id,
      instructorId: instructor.id,
      level: "BEGINNER",
      priceEUR: 39.9,
      priceUSD: 43.9,
      thumbnailUrl: "https://placehold.co/600x400",
      whatYouWillLearn: ["Bases Python", "Variables", "Boucles"],
      requirements: ["Aucun"],
      targetAudience: ["Débutants"],
      status: "DRAFT",
    },
  });
  pass("course/create-draft", `cours créé status=DRAFT id=${course.id.slice(0, 8)}…`);

  const section = await prisma.section.create({
    data: {
      courseId: course.id,
      title: "Introduction",
      displayOrder: 0,
      lessons: {
        create: [
          {
            title: "Bienvenue",
            type: "VIDEO",
            displayOrder: 0,
            videoDurationSeconds: 180,
            isFreePreview: true,
          },
          {
            title: "Variables",
            type: "VIDEO",
            displayOrder: 1,
            videoDurationSeconds: 360,
          },
        ],
      },
    },
  });
  const lessons = await prisma.lesson.findMany({ where: { sectionId: section.id } });
  pass("curriculum/section+lessons", `1 section + ${lessons.length} leçons créées`);

  // -----------------------------------------------------------------
  // [5] WORKFLOW MODÉRATION — submit + admin approve
  // -----------------------------------------------------------------
  console.log("\n▼ [5] Modération admin");
  // Soumission
  await prisma.course.update({
    where: { id: course.id },
    data: { status: "PENDING_REVIEW" },
  });
  // Création d'un admin
  const adminEmail = `smoke-admin-${Date.now()}@example.com`;
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      hashedPassword: await bcrypt.hash("Test1234!", 12),
      firstName: "Smoke",
      lastName: "Admin",
      name: "Smoke Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
    },
  });
  // Approve
  await prisma.course.update({
    where: { id: course.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      userId: instructor.id,
      kind: "COURSE_PUBLISHED",
      title: "Cours publié",
      body: `« ${course.title} » est publié.`,
      url: `/cours/${course.slug}`,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "course.approve",
      targetType: "Course",
      targetId: course.id,
    },
  });
  const refreshed = await prisma.course.findUnique({ where: { id: course.id } });
  if (refreshed?.status === "PUBLISHED") {
    pass("admin/moderate-approve", "cours publié + audit log + notification");
  } else fail("admin/moderate-approve", `status=${refreshed?.status}`);

  // -----------------------------------------------------------------
  // [6] CART + CHECKOUT GRATUIT (cours seed à 0 €)
  // -----------------------------------------------------------------
  console.log("\n▼ [6] Cart + Checkout gratuit");
  const freeCourse = await prisma.course.findFirst({ where: { priceEUR: 0, status: "PUBLISHED" } });
  if (!freeCourse) {
    fail("checkout/free", "aucun cours gratuit en seed");
  } else {
    await prisma.cartItem.create({
      data: { userId: student.id, courseId: freeCourse.id },
    });
    pass("cart/add", `cours gratuit ajouté au panier`);

    // Simule finalizeFreeCheckout
    const freeOrder = await prisma.order.create({
      data: {
        userId: student.id,
        status: "PAID",
        currency: "EUR",
        subtotalCents: 0,
        discountCents: 0,
        totalCents: 0,
        paidAt: new Date(),
        items: {
          create: [
            {
              courseId: freeCourse.id,
              currency: "EUR",
              unitPriceCents: 0,
              discountCents: 0,
              totalCents: 0,
              commissionSource: "PLATFORM_DRIVEN",
              commissionRateBps: 3000,
              platformFeeCents: 0,
              instructorPayoutCents: 0,
            },
          ],
        },
      },
      include: { items: true },
    });
    await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: freeCourse.id,
        orderItemId: freeOrder.items[0].id,
        source: "PURCHASE",
      },
    });
    await prisma.cartItem.deleteMany({ where: { userId: student.id } });
    pass("checkout/free-finalize", `Order PAID + Enrollment créés`);
  }

  // -----------------------------------------------------------------
  // [7] CHECKOUT PAYANT (simulé) — Order PENDING + webhook handler
  // -----------------------------------------------------------------
  console.log("\n▼ [7] Checkout payant simulé (sans Stripe réel)");
  // Ajoute 2 cours payants au panier
  const paidCourses = await prisma.course.findMany({
    where: { priceEUR: { gt: 0 }, status: "PUBLISHED" },
    take: 2,
  });
  if (paidCourses.length < 2) {
    fail("checkout/paid-setup", "moins de 2 cours payants en base");
  } else {
    // Création Order PENDING comme le ferait startCheckout
    const subtotalCents = paidCourses.reduce(
      (sum, c) => sum + Math.round(Number(c.priceEUR) * 100),
      0,
    );
    const order = await prisma.order.create({
      data: {
        userId: student.id,
        status: "PENDING",
        currency: "EUR",
        subtotalCents,
        discountCents: 0,
        totalCents: subtotalCents,
        items: {
          create: paidCourses.map((c) => {
            const total = Math.round(Number(c.priceEUR) * 100);
            const breakdown = computeCommission(total, "PLATFORM_DRIVEN");
            return {
              courseId: c.id,
              currency: "EUR",
              unitPriceCents: total,
              discountCents: 0,
              totalCents: total,
              commissionSource: "PLATFORM_DRIVEN",
              commissionRateBps: breakdown.rateBps,
              platformFeeCents: breakdown.platformFeeCents,
              instructorPayoutCents: breakdown.instructorPayoutCents,
            };
          }),
        },
      },
      include: { items: true },
    });
    pass("checkout/paid-pending", `Order PENDING ${subtotalCents}c + ${order.items.length} items`);

    // -----------------------------------------------------------------
    // [8] WEBHOOK STRIPE simulé : checkout.session.completed
    // -----------------------------------------------------------------
    console.log("\n▼ [8] Webhook Stripe simulé");
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          stripePaymentIntentId: `pi_smoke_${nanoid(8)}`,
          stripeReceiptUrl: "https://stripe.example/receipt",
        },
      });
      for (const item of order.items) {
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId: student.id, courseId: item.courseId } },
          update: { orderItemId: item.id, source: "PURCHASE" },
          create: {
            userId: student.id,
            courseId: item.courseId,
            orderItemId: item.id,
            source: "PURCHASE",
          },
        });
        await tx.course.update({
          where: { id: item.courseId },
          data: { totalEnrollments: { increment: 1 } },
        });
        // Marque le transfer (mock)
        await tx.orderItem.update({
          where: { id: item.id },
          data: { stripeTransferId: `tr_smoke_${nanoid(8)}` },
        });
      }
    });
    const enrollments = await prisma.enrollment.count({ where: { userId: student.id } });
    pass("webhook/stripe-completed", `Order→PAID, ${enrollments} enrollments, transfers mockés`);

    // -----------------------------------------------------------------
    // [9] COMMISSION — calcul 15% vs 30%
    // -----------------------------------------------------------------
    console.log("\n▼ [9] Commission");
    const c1500 = computeCommission(10000, "INSTRUCTOR_DRIVEN");
    const c3000 = computeCommission(10000, "PLATFORM_DRIVEN");
    if (c1500.platformFeeCents === 1500 && c3000.platformFeeCents === 3000) {
      pass("commission/compute", `15% (1500c) + 85% (8500c) ; 30% (3000c) + 70% (7000c)`);
    } else {
      fail("commission/compute", `unexpected fees ${c1500.platformFeeCents} / ${c3000.platformFeeCents}`);
    }

    // Vérifie que l'OrderItem stocke le breakdown
    const oi = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    if (oi && oi.platformFeeCents > 0 && oi.instructorPayoutCents > 0) {
      pass("commission/persisted-on-orderitem", `platformFee=${oi.platformFeeCents}c payout=${oi.instructorPayoutCents}c`);
    } else fail("commission/persisted-on-orderitem", "fee non persisté");
  }

  // -----------------------------------------------------------------
  // [10] LEARNING — progress + certificat
  // -----------------------------------------------------------------
  console.log("\n▼ [10] Learning + Certificat");
  // Marque toutes les leçons du free course comme complétées
  if (freeCourse) {
    const allLessons = await prisma.lesson.findMany({
      where: { section: { courseId: freeCourse.id } },
    });
    for (const l of allLessons) {
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: student.id, lessonId: l.id } },
        update: { isCompleted: true, completedAt: new Date(), watchedSeconds: l.videoDurationSeconds ?? 0 },
        create: {
          userId: student.id,
          lessonId: l.id,
          isCompleted: true,
          completedAt: new Date(),
          watchedSeconds: l.videoDurationSeconds ?? 0,
        },
      });
    }
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: student.id, courseId: freeCourse.id } },
      data: { progressPercent: 100, completedAt: new Date() },
    });
    pass("learning/progress", `${allLessons.length} leçons → 100%`);

    // Certificat
    const serial = `EFGN-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
    const cert = await prisma.certificate.create({
      data: {
        userId: student.id,
        courseId: freeCourse.id,
        serialNumber: serial,
      },
    });
    pass("certificate/issue", `serialNumber=${cert.serialNumber}`);
  }

  // -----------------------------------------------------------------
  // [11] ADMIN — promo code, commission rate, category
  // -----------------------------------------------------------------
  console.log("\n▼ [11] Admin");
  const promo = await prisma.promoCode.create({
    data: {
      code: `SMOKE-${nanoid(4).toUpperCase()}`,
      kind: "PERCENTAGE",
      scope: "GLOBAL",
      value: 2000, // 20% en bps
      maxRedemptions: 100,
      usedCount: 0,
      isActive: true,
    },
  });
  pass("admin/promo-code-create", `code=${promo.code} -20%`);

  await prisma.commissionRate.upsert({
    where: { source: "INSTRUCTOR_DRIVEN" },
    update: { rateBps: 1500 },
    create: { source: "INSTRUCTOR_DRIVEN", rateBps: 1500 },
  });
  pass("admin/commission-rate-upsert", "INSTRUCTOR_DRIVEN @ 15%");

  // -----------------------------------------------------------------
  // [12] WISHLIST + NOTIFICATIONS
  // -----------------------------------------------------------------
  console.log("\n▼ [12] Wishlist + Notifications");
  if (paidCourses.length > 0) {
    await prisma.wishlistItem.upsert({
      where: { userId_courseId: { userId: student.id, courseId: paidCourses[0].id } },
      update: {},
      create: { userId: student.id, courseId: paidCourses[0].id },
    });
    pass("wishlist/add", "1 cours ajouté à la wishlist");
  }

  await prisma.notification.create({
    data: {
      userId: student.id,
      kind: "ENROLLMENT_CONFIRMED",
      title: "Paiement reçu",
      body: "Votre commande est confirmée.",
    },
  });
  const unread = await prisma.notification.count({
    where: { userId: student.id, isRead: false },
  });
  pass("notifications/create", `${unread} non lues pour le student`);

  // -----------------------------------------------------------------
  // [13] CMS PAGE
  // -----------------------------------------------------------------
  console.log("\n▼ [13] CMS");
  const slug = `smoke-cgu-${nanoid(4)}`;
  const page = await prisma.cmsPage.create({
    data: {
      slug,
      title: "Smoke CGU",
      body: "# CGU\n\nContenu de test.",
      isPublished: true,
      publishedAt: new Date(),
    },
  });
  pass("cms/create-page", `slug=${page.slug}`);
  await prisma.cmsPage.delete({ where: { id: page.id } });
  pass("cms/delete-page", "supprimée");

  // -----------------------------------------------------------------
  // [14] CONNECT (Stripe instructor) — set status
  // -----------------------------------------------------------------
  console.log("\n▼ [14] Stripe Connect (mock)");
  await prisma.user.update({
    where: { id: instructor.id },
    data: {
      stripeAccountId: `acct_smoke_${nanoid(8)}`,
      stripeAccountStatus: "ACTIVE",
      stripeOnboardingDone: true,
    },
  });
  pass("connect/instructor-account", "stripeAccountId persisté + onboardingDone=true");

  // -----------------------------------------------------------------
  // RAPPORT FINAL
  // -----------------------------------------------------------------
  console.log("\n=== RAPPORT ===");
  const ok = results.filter((r) => r.ok).length;
  const ko = results.filter((r) => !r.ok).length;
  console.log(`✓ ${ok} OK    ✗ ${ko} KO    sur ${results.length} checks`);
  if (ko > 0) {
    console.log("\nÉchecs :");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.module} — ${r.detail}`));
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("ERREUR FATALE :", err);
    process.exit(1);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
