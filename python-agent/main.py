"""main.py — chat loop di terminal buat ngobrol sama asisten AI lokal."""

from core import agent, brain


def main():
    print("=" * 50)
    print("  🤖 Asisten AI Pribadi (lokal, pakai Gemma 4)")
    print("=" * 50)
    print(f"  Model: {brain.DEFAULT_MODEL}")
    print("  Ketik 'keluar' atau Ctrl+C buat berhenti.")
    print("=" * 50)

    history = []
    while True:
        try:
            user_input = input("\n🧑 Kamu: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n👋 Dadah cuy!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("keluar", "exit", "quit"):
            print("👋 Dadah cuy!")
            break

        try:
            answer = agent.run(user_input, history)
            print(f"\n🤖 AI: {answer}")
        except RuntimeError as e:
            print(f"\n⚠️  {e}")
        except Exception as e:
            print(f"\n⚠️  Ada error: {e}")


if __name__ == "__main__":
    main()
