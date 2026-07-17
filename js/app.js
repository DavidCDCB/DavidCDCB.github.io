const { createApp } = Vue;

// Ancho A4 exacto en píxeles CSS a 96 DPI: 210mm * 96 / 25.4 ≈ 793.7 → 794
const A4_WIDTH_PX = 794;

createApp({
    data() {
        return {
            // Diccionario completo con ambos idiomas (se carga desde data/content.json)
            i18n: null,
            // Idioma activo
            lang: 'es',
            // Estado de carga de datos
            loading: true,
            loadError: false,
            // Estado de los botones de descarga
            generatingPdf: false,
            generatingPng: false,
        };
    },

    computed: {
        // Contenido del idioma activo. Toda la plantilla se renderiza a partir de aquí.
        c() {
            return this.i18n ? this.i18n[this.lang] : null;
        },
    },

    watch: {
        // Sincroniza <html lang> y el <title> del documento con el idioma activo.
        c(value) {
            if (!value) return;
            document.documentElement.lang = value.meta.htmlLang;
            document.title = value.meta.title;
        },
    },

    async created() {
        try {
            const response = await fetch('./data/content.json');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            this.i18n = await response.json();
        } catch (err) {
            console.error('No se pudo cargar data/content.json', err);
            this.loadError = true;
        } finally {
            this.loading = false;
        }
    },

    methods: {
        toggleLanguage() {
            this.lang = this.lang === 'es' ? 'en' : 'es';
        },

        /**
         * Aplica los estilos de exportación, espera fuentes/layout y captura el .sheet.
         * Devuelve el <canvas> resultante. Limpia el estado en cualquier caso.
         */
        async captureSheetCanvas() {
            document.body.classList.add('pdf-export');
            try {
                if (document.fonts && document.fonts.ready) {
                    await document.fonts.ready;
                }
                // Doble rAF: espera a que el navegador aplique el layout con la clase pdf-export
                await new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                );

                return await html2canvas(this.$refs.sheet, {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    backgroundColor: '#ffffff',
                    width: A4_WIDTH_PX,
                    windowWidth: A4_WIDTH_PX,
                    x: 0,
                    y: 0,
                    scrollX: 0,
                    scrollY: -window.scrollY,
                });
            } finally {
                document.body.classList.remove('pdf-export');
            }
        },

        async downloadPdf() {
            if (this.generatingPdf) return;
            this.generatingPdf = true;
            try {
                const canvas = await this.captureSheetCanvas();

                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait',
                    compress: true,
                });

                const pdfWidth = pdf.internal.pageSize.getWidth(); // 210
                const pdfHeight = pdf.internal.pageSize.getHeight(); // 297
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                const imgData = canvas.toDataURL('image/jpeg', 0.98);

                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                    heightLeft -= pdfHeight;
                }

                pdf.save('Christian-David-Cruz-Barrera-CV.pdf');
            } catch (err) {
                console.error(err);
                alert(this.c.ui.errorGeneric);
            } finally {
                this.generatingPdf = false;
            }
        },

        async downloadPng() {
            if (this.generatingPng) return;
            this.generatingPng = true;
            try {
                const canvas = await this.captureSheetCanvas();

                // canvas.toBlob es más eficiente que toDataURL para archivos grandes
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'Christian-David-Cruz-Barrera-CV.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } catch (err) {
                console.error(err);
                alert(this.c.ui.errorGeneric);
            } finally {
                this.generatingPng = false;
            }
        },
    },
}).mount('#app');
