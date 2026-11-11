use anyhow::{Result, ensure};

pub(super) struct Reader<'a>(pub(super) &'a [u8]);

impl<'a> Reader<'a> {
    pub(super) fn new(bytes: &'a [u8]) -> Self {
        Self(bytes)
    }
    pub(super) fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        ensure!(self.0.len() >= n, "gallery file truncated");
        let (head, rest) = self.0.split_at(n);
        self.0 = rest;
        Ok(head)
    }

    pub(super) fn len(&mut self) -> Result<usize> {
        Ok(usize::try_from(u32::from_le_bytes(
            self.take(4)?.try_into()?,
        ))?)
    }

    /// A length-prefixed run of little-endian `f32`.
    pub(super) fn floats(&mut self) -> Result<Vec<f32>> {
        let len = self.len()?;
        Ok(self
            .take(4 * len)?
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect())
    }

    pub(super) fn string(&mut self) -> Result<String> {
        let len = self.len()?;
        Ok(String::from_utf8(self.take(len)?.to_vec())?)
    }
}
