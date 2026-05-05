import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "doxuanbang14122005@gmail.com";
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    // Delete related records first if needed, or just delete user. 
    // If there are foreign keys, we might need to delete them or use deleteMany.
    // Let's try to update the clerkId to null so it can be re-linked, 
    // or just delete the user.
    await prisma.user.update({
      where: { email },
      data: { clerkId: null }
    });
    console.log(`Unlinked old clerkId for ${email}`);
  } else {
    console.log(`User ${email} not found`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
